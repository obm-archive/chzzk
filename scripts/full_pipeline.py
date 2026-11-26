"""Full-length VOD pipeline: resumable Groq transcription + windowed Gemini summarization.

Usage:
  python scripts/full_pipeline.py transcribe <chunks_dir> <tx_dir> <status_file> <budget_min> [glossary]
  python scripts/full_pipeline.py summarize  <tx_dir> <out_dir> <meta_json> [glossary]

Env: GROQ_API, GEMINI_API
"""
import glob
import json
import os
import re
import subprocess
import sys
import time

import requests
from google.genai import types

from groq_pipeline import GROQ_MODEL, GROQ_URL, dedupe, load_glossary
from summarize import USAGE, fmt, generate, get_client

WINDOW_SEC = 1800
# Price assumptions for the cost estimate (USD per 1M tokens, Gemini 3.8 Flash intro price) and Groq per audio hour.
GEMINI_IN, GEMINI_OUT, GROQ_PER_HOUR, KRW = 0.75, 3.75, 0.04, 1400


# ---------------------------------------------------------------- transcription
def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    ).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def parse_wait(resp):
    """Seconds to wait from retry-after header or 'try again in 1h2m3.4s' message."""
    ra = resp.headers.get("retry-after")
    if ra:
        try:
            return float(ra)
        except ValueError:
            pass
    m = re.search(r"try again in ((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)", resp.text)
    if m and m.group(1):
        h = re.search(r"(\d+)h", m.group(1))
        mi = re.search(r"(\d+)m", m.group(1))
        s = re.search(r"([\d.]+)s", m.group(1))
        return (int(h.group(1)) * 3600 if h else 0) + (int(mi.group(1)) * 60 if mi else 0) + (float(s.group(1)) if s else 0)
    return 60.0


def transcribe_one(key, path, prompt, deadline, stats):
    data = {
        "model": GROQ_MODEL,
        "language": "ko",
        "response_format": "verbose_json",
        "temperature": "0",
        "timestamp_granularities[]": "segment",
    }
    if prompt:
        data["prompt"] = prompt
    for attempt in range(40):
        with open(path, "rb") as fh:
            r = requests.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {key}"},
                files={"file": (os.path.basename(path), fh, "audio/mpeg")},
                data=data,
                timeout=600,
            )
        if r.status_code == 200:
            return r.json()
        if r.status_code == 400 and "audio_too_short" in r.text:
            return {"segments": []}
        if r.status_code in (429, 500, 502, 503):
            wait = parse_wait(r) + 5 if r.status_code == 429 else 20 * min(attempt + 1, 6)
            if time.time() + wait > deadline:
                print(f"Wait {wait:.0f}s would exceed the time budget; stopping here.")
                return None
            stats["waits"].append({"status": r.status_code, "seconds": round(wait)})
            print(f"Groq {r.status_code} on {os.path.basename(path)}: {r.text[:160]!r}; waiting {wait:.0f}s")
            time.sleep(wait)
            continue
        raise RuntimeError(f"Groq error {r.status_code}: {r.text[:300]}")
    raise RuntimeError("Groq: too many retries")


def cmd_transcribe(chunks_dir, tx_dir, status_file, budget_min, glossary_file=None):
    key = os.environ.get("GROQ_API", "").strip()
    if not key:
        print("ERROR: GROQ_API secret is empty or not registered.")
        sys.exit(1)
    os.makedirs(tx_dir, exist_ok=True)
    prompt = ", ".join(load_glossary(glossary_file))[:500]
    deadline = time.time() + float(budget_min) * 60
    files = sorted(glob.glob(os.path.join(chunks_dir, "*.mp3")))
    durations = {os.path.basename(f): probe_duration(f) for f in files}
    json.dump(durations, open(os.path.join(tx_dir, "durations.json"), "w"))
    stats = {"waits": []}
    t0 = time.time()
    done = 0
    for f in files:
        name = os.path.basename(f)
        out = os.path.join(tx_dir, name + ".json")
        if os.path.exists(out):
            done += 1
            continue
        if os.path.getsize(f) < 2000:
            res = {"segments": []}
        else:
            res = transcribe_one(key, f, prompt, deadline, stats)
            if res is None:
                break
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        done += 1
        print(f"chunk {done}/{len(files)} done ({time.time() - t0:.0f}s elapsed)")
    status = {
        "complete": done == len(files),
        "done": done,
        "total": len(files),
        "audio_seconds": round(sum(durations.values()), 1),
        "groq_wall_seconds_this_run": round(time.time() - t0),
        "waited_seconds_this_run": sum(w["seconds"] for w in stats["waits"]),
        "wait_events": len(stats["waits"]),
    }
    json.dump(status, open(status_file, "w"), ensure_ascii=False)
    print("STATUS", json.dumps(status))


# ---------------------------------------------------------------- summarization
def norm(s):
    return re.sub(r"[\s\.,!?~…\"'“”‘’\-\(\)\[\]]", "", s or "")


def parse_json(text):
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.M).strip()
    return json.loads(t)


def ask_json(client, prompt, tries=2):
    last = None
    for _ in range(tries):
        model, text = generate(
            client, [prompt], types.GenerateContentConfig(response_mime_type="application/json")
        )
        try:
            return model, parse_json(text)
        except json.JSONDecodeError as e:
            last = e
            print("JSON parse failed; retrying:", e)
    raise RuntimeError(f"JSON parse failed twice: {last}")


def load_segments(tx_dir):
    durations = json.load(open(os.path.join(tx_dir, "durations.json")))
    segs, offset, removed_before = [], 0.0, 0
    for name in sorted(durations):
        res = json.load(open(os.path.join(tx_dir, name + ".json"), encoding="utf-8"))
        for s in res.get("segments", []):
            segs.append({
                "start": round(offset + s["start"], 2),
                "end": round(offset + s["end"], 2),
                "text": s["text"].strip(),
            })
        offset += durations[name]
    removed_before = len(segs)
    segs = [s for s in dedupe(segs) if s["text"]]
    return segs, offset, removed_before - len(segs)


def window_prompt(meta, gloss_text, ws, we, lines, prev):
    return f"""당신은 한국어 인터넷 방송(치지직) 전사본을 정리하는 분석가입니다.
전사본은 음성인식 결과라서 고유명사, 닉네임, 게임 용어에 오인식이 있을 수 있습니다.
각 줄 앞의 [hh:mm:ss]는 방송 전체 기준 시각입니다.

[방송 정보] 제목: {meta.get('title')} / 카테고리: {meta.get('category')} / 시작: {meta.get('start')} / 전체 길이: {fmt(meta.get('duration', 0))}
[이번 구간] {fmt(ws)} ~ {fmt(we)} (방송 전체 중 일부입니다)
[직전 구간 마지막 요약(맥락용)] {prev or '없음'}

아래 JSON 형식으로만 답하세요. 다른 설명은 쓰지 마세요.
{{
  "segments": [
    {{
      "start": "hh:mm:ss",
      "end": "hh:mm:ss",
      "title": "구간 한 줄 제목",
      "summary": "이 구간에서 나온 이야기 2~4문장",
      "quotes": [{{"time": "hh:mm:ss", "text": "스트리머가 한 주요 대사 (전사본 문장 그대로, 1~2문장)"}}],
      "keywords": ["구간 키워드 3~5개"],
      "search_terms": ["나중에 검색할 때 쓸 만한 구체적 단어/표현 8~15개"],
      "type": "talk | game | mixed | silence"
    }}
  ],
  "glossary_candidates": [
    {{"term": "처음 보는 고유명사/닉네임/반복 표현", "context": "등장한 맥락 한 문장", "guess_type": "닉네임 | 밈 | 인물 | 게임용어 | 기타", "time": "hh:mm:ss"}}
  ],
  "uncertain_points": ["오인식이 의심되거나 확신이 없는 부분 (시각 포함)"]
}}

규칙:
- 구간은 약 5분 단위로 나누되 주제가 바뀌는 지점을 우선하세요. 시각은 전사본의 시각을 그대로 사용하세요. 이번 구간({fmt(ws)}~{fmt(we)}) 밖의 시각은 쓰지 마세요.
- quotes는 각 구간마다 1~2개입니다. 그 구간에서 스트리머 본인이 한 말 중 내용을 가장 잘 보여주는 문장을 전사본에서 한 글자도 바꾸지 말고 그대로 복사하세요. 요약하거나 고쳐 쓰지 마세요.
- 시청자 닉네임, 도네이션/TTS 낭독, 채팅 낭독은 스트리머 본인의 발언이 아닙니다. 이런 문장은 quotes에 넣지 마세요. 스트리머의 대사로 확신할 수 있는 문장이 없으면 quotes는 빈 배열로 두세요.
- 전사본에 없는 내용을 추측해서 쓰지 마세요.
- 아래 용어집에 있는 용어는 그 설명을 따르세요.

[용어집]
{gloss_text}

[전사본]
{chr(10).join(lines)}
"""


def cmd_summarize(tx_dir, out_dir, meta_file, glossary_file=None):
    os.makedirs(out_dir, exist_ok=True)
    meta = json.load(open(meta_file, encoding="utf-8"))
    timing = meta.get("timing", {})
    glossary = load_glossary(glossary_file)
    gloss_text = "\n".join(f"- {t}" for t in glossary) if glossary else "(아직 등록된 용어 없음)"
    segs, audio_total, removed = load_segments(tx_dir)
    transcript = "\n".join(f"[{fmt(s['start'])}] {s['text']}" for s in segs)
    open(os.path.join(out_dir, "transcript.txt"), "w", encoding="utf-8").write(transcript)
    json.dump(segs, open(os.path.join(out_dir, "transcript.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{len(segs)} transcript lines, audio {audio_total:.0f}s (VOD says {meta.get('duration')}s), dedupe removed {removed}")

    client = get_client()
    all_segments, gloss_cands, uncertain, windows_log = [], [], [], []
    prev = ""
    n_windows = int(audio_total // WINDOW_SEC) + 1
    for w in range(n_windows):
        ws, we = w * WINDOW_SEC, min((w + 1) * WINDOW_SEC, audio_total)
        sel = [s for s in segs if ws <= s["start"] < we]
        if not sel:
            continue
        lines = [f"[{fmt(s['start'])}] {s['text']}" for s in sel]
        win_norm = norm("".join(s["text"] for s in sel))
        before = len(USAGE)
        model, data = ask_json(client, window_prompt(meta, gloss_text, ws, we, lines, prev))
        us = USAGE[before:]
        windows_log.append({
            "window": f"{fmt(ws)}~{fmt(we)}", "lines": len(sel), "model": model,
            "prompt": sum(u.get("prompt") or 0 for u in us), "output": sum(u.get("output") or 0 for u in us),
            "segments": len(data.get("segments", [])),
        })
        for sg in data.get("segments", []):
            for q in sg.get("quotes", []):
                q["verified"] = bool(norm(q.get("text")) and norm(q.get("text")) in win_norm)
            all_segments.append(sg)
        gloss_cands += data.get("glossary_candidates", [])
        uncertain += data.get("uncertain_points", [])
        if data.get("segments"):
            last = data["segments"][-1]
            prev = f"{last.get('title')}: {last.get('summary')}"
        print(f"window {w + 1}/{n_windows} done ({len(data.get('segments', []))} segments)")

    # merge step: overall summary from segment summaries (no transcript)
    digest = "\n".join(
        f"[{s.get('start')}~{s.get('end')}] ({s.get('type')}) {s.get('title')} - {s.get('summary')}" for s in all_segments
    )
    merge_prompt = f"""아래는 한 번의 방송(제목: {meta.get('title')}, 카테고리: {meta.get('category')}, 길이 {fmt(meta.get('duration', 0))})을 구간별로 요약한 목록입니다.
이를 바탕으로 JSON만 답하세요.
{{
  "overall_summary": "방송 전체 요약 4~6문장 (주요 이야기 흐름, 한 게임이 있다면 게임 이름과 진행 내용 포함)",
  "keywords": ["방송 전체 핵심 키워드 최대 10개"],
  "games": ["방송에서 플레이한 게임 이름. 없으면 빈 배열"],
  "parts": [{{"start": "hh:mm:ss", "end": "hh:mm:ss", "label": "큰 흐름 한 줄 (예: 일상 토크, 게임 플레이)"}}]
}}
규칙: 목록에 없는 내용을 추측하지 마세요. 시청자/도네이션 발언은 스트리머 발언으로 쓰지 마세요.

[구간 요약 목록]
{digest}
"""
    before = len(USAGE)
    model, merged = ask_json(client, merge_prompt)
    mus = USAGE[before:]
    windows_log.append({
        "window": "merge", "model": model,
        "prompt": sum(u.get("prompt") or 0 for u in mus), "output": sum(u.get("output") or 0 for u in mus),
    })

    result = {"meta": meta, "overall": merged, "segments": all_segments,
              "glossary_candidates": gloss_cands, "uncertain_points": uncertain}
    json.dump(result, open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # measurements
    tin = sum(u.get("prompt") or 0 for u in USAGE)
    tout = sum(u.get("output") or 0 for u in USAGE)
    tth = sum(u.get("thoughts") or 0 for u in USAGE)
    gem_usd = tin / 1e6 * GEMINI_IN + (tout + tth) / 1e6 * GEMINI_OUT
    groq_usd = audio_total / 3600 * GROQ_PER_HOUR
    quotes = [q for s in all_segments for q in s.get("quotes", [])]
    vq = sum(1 for q in quotes if q.get("verified"))
    empty_q = sum(1 for s in all_segments if not s.get("quotes"))
    stats = {
        "audio_seconds": round(audio_total), "vod_seconds": meta.get("duration"),
        "transcript_lines": len(segs), "dedupe_removed": removed,
        "segments": len(all_segments), "quotes": len(quotes), "quotes_verified": vq,
        "segments_without_quote": empty_q,
        "gemini_tokens": {"prompt": tin, "output": tout, "thoughts": tth},
        "cost_estimate_krw": {"gemini": round(gem_usd * KRW), "groq": round(groq_usd * KRW),
                              "total": round((gem_usd + groq_usd) * KRW)},
        "windows": windows_log, "timing": timing,
    }
    json.dump(stats, open(os.path.join(out_dir, "stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    L = [f"# 전체 방송 처리 결과 - {meta.get('title')} (방송 {meta.get('video_no')})", ""]
    L += ["## 측정값",
          f"- 방송 길이(VOD 정보) {fmt(meta.get('duration', 0))} / 실제 오디오 합계 {fmt(audio_total)} (차이 {round(audio_total - (meta.get('duration') or 0))}초)",
          f"- 전사 줄 수 {len(segs)} (반복 환각 제거 {removed}줄), 구간 수 {len(all_segments)}",
          f"- 대사 인용 {len(quotes)}개 중 전사본과 일치 확인 {vq}개, 대사 없는 구간 {empty_q}개",
          f"- Gemini 토큰: 입력 {tin:,} / 출력 {tout:,} / 사고 {tth:,}",
          f"- 소요 시간(초): {json.dumps(timing, ensure_ascii=False)}",
          f"- 비용 추정(원, 1달러=1,400원, 가격 가정): Gemini {stats['cost_estimate_krw']['gemini']:,} + Groq {stats['cost_estimate_krw']['groq']:,} = {stats['cost_estimate_krw']['total']:,}",
          ""]
    L += ["## 전체 요약", merged.get("overall_summary", ""), "",
          "## 키워드", ", ".join(merged.get("keywords", [])), "",
          "## 플레이한 게임", ", ".join(merged.get("games", [])) or "없음", "", "## 큰 흐름"]
    L += [f"- {p.get('start')} ~ {p.get('end')}: {p.get('label')}" for p in merged.get("parts", [])]
    L += ["", "## 구간별 요약"]
    for s in all_segments:
        L += [f"### [{s.get('start')} ~ {s.get('end')}] {s.get('title')} ({s.get('type')})", s.get("summary", "")]
        for q in s.get("quotes", []):
            L.append(f"> [{q.get('time')}] \"{q.get('text')}\"" + ("" if q.get("verified") else "  (전사본과 불일치)"))
        L += ["키워드: " + ", ".join(s.get("keywords", [])), "검색어: " + ", ".join(s.get("search_terms", [])), ""]
    if gloss_cands:
        L += ["## 용어집 후보"] + [
            f"- [{g.get('time')}] {g.get('term')} ({g.get('guess_type')}): {g.get('context')}" for g in gloss_cands] + [""]
    if uncertain:
        L += ["## 불확실한 부분"] + [f"- {u}" for u in uncertain] + [""]
    open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8").write("\n".join(L))
    print("Done.", json.dumps(stats["cost_estimate_krw"]))


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "transcribe":
        cmd_transcribe(*args)
    elif cmd == "summarize":
        cmd_summarize(*args)
    else:
        sys.exit(f"unknown command {cmd}")
