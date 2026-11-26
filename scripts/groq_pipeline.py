"""Transcribe audio chunks with Groq Whisper, then summarize the transcript with Gemini (text only).

Usage:
    python scripts/groq_pipeline.py <chunks_dir> <out_dir> <start_sec> <chunk_sec> [glossary_file]

Env: GROQ_API (Groq key), GEMINI_API (Gemini key).
"""
import glob
import json
import os
import sys
import time

import requests
from google.genai import types

from summarize import USAGE, fmt, generate, get_client

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "whisper-large-v3-turbo")


def load_glossary(path):
    if path and os.path.exists(path):
        terms = [
            ln.strip()
            for ln in open(path, encoding="utf-8")
            if ln.strip() and not ln.startswith("#")
        ]
        return terms
    return []


def transcribe_chunk(key, path, prompt):
    data = {
        "model": GROQ_MODEL,
        "language": "ko",
        "response_format": "verbose_json",
        "temperature": "0",
        "timestamp_granularities[]": "segment",
    }
    if prompt:
        data["prompt"] = prompt
    for attempt in range(6):
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
        if r.status_code in (429, 500, 502, 503):
            try:
                wait = float(r.headers.get("retry-after", 20 * (attempt + 1)))
            except ValueError:
                wait = 20 * (attempt + 1)
            wait = min(wait, 180)
            print(f"Groq {r.status_code} on {os.path.basename(path)}; waiting {wait:.0f}s")
            time.sleep(wait)
            continue
        if r.status_code == 400 and "audio_too_short" in r.text:
            print(f"{os.path.basename(path)} is too short; skipping.")
            return {"segments": []}
        raise RuntimeError(f"Groq error {r.status_code}: {r.text[:300]}")
    raise RuntimeError("Groq: too many retries")


def dedupe(segments):
    """Drop runs of identical consecutive lines (common Whisper hallucination)."""
    out, run = [], 0
    prev = None
    for s in segments:
        t = s["text"].strip()
        if t and t == prev:
            run += 1
            if run >= 2:
                continue
        else:
            run = 0
        prev = t
        out.append(s)
    return out


def main():
    chunks_dir, out_dir, start_sec, chunk_sec = sys.argv[1:5]
    glossary_file = sys.argv[5] if len(sys.argv) > 5 else None
    start_sec, chunk_sec = int(start_sec), int(chunk_sec)
    os.makedirs(out_dir, exist_ok=True)

    groq_key = os.environ.get("GROQ_API", "").strip()
    if not groq_key:
        print("ERROR: GROQ_API secret is empty or not registered.")
        sys.exit(1)
    print(f"Groq key loaded (length={len(groq_key)}).")

    glossary = load_glossary(glossary_file)
    prompt = ", ".join(glossary)[:500] if glossary else ""

    # 1) Transcribe each chunk
    files = sorted(glob.glob(os.path.join(chunks_dir, "*.mp3")))
    print(f"{len(files)} audio chunks.")
    segments = []
    t0 = time.time()
    for i, f in enumerate(files):
        if os.path.getsize(f) < 2000:
            print(f"{os.path.basename(f)} is tiny ({os.path.getsize(f)} bytes); skipping.")
            continue
        offset = start_sec + i * chunk_sec
        res = transcribe_chunk(groq_key, f, prompt)
        for s in res.get("segments", []):
            segments.append({
                "start": round(offset + s["start"], 2),
                "end": round(offset + s["end"], 2),
                "text": s["text"].strip(),
                "no_speech_prob": s.get("no_speech_prob"),
                "avg_logprob": s.get("avg_logprob"),
            })
        print(f"chunk {i + 1}/{len(files)} done")
    groq_seconds = time.time() - t0
    segments = dedupe(segments)

    transcript = "\n".join(f"[{fmt(s['start'])}] {s['text']}" for s in segments if s["text"])
    with open(os.path.join(out_dir, "transcript.txt"), "w", encoding="utf-8") as fh:
        fh.write(transcript)
    with open(os.path.join(out_dir, "transcript.json"), "w", encoding="utf-8") as fh:
        json.dump(segments, fh, ensure_ascii=False)
    print(f"Transcript: {len(segments)} lines, {len(transcript)} chars, Groq time {groq_seconds:.0f}s")

    # 2) Summarize transcript with Gemini (text only)
    client = get_client()
    gloss_text = "\n".join(f"- {t}" for t in glossary) if glossary else "(아직 등록된 용어 없음)"
    prompt_sum = f"""당신은 한국어 인터넷 방송(치지직) 전사본을 정리하는 분석가입니다.
아래 전사본은 음성인식 결과라서 고유명사, 닉네임, 게임 용어에 오인식이 있을 수 있습니다.
각 줄 앞의 [hh:mm:ss]는 방송 전체 기준 시각입니다.
아래 JSON 형식으로만 답하세요. 다른 설명은 쓰지 마세요.

{{
  "overall_summary": "전체 요약 3~5문장",
  "keywords": ["핵심 키워드 최대 10개"],
  "segments": [
    {{
      "start": "hh:mm:ss",
      "end": "hh:mm:ss",
      "title": "구간 한 줄 제목",
      "summary": "이 구간에서 나온 이야기 2~4문장",
      "keywords": ["구간 키워드 3~5개"],
      "search_terms": ["나중에 검색할 때 쓸 만한 구체적 단어/표현 8~15개 (고유명사, 지명, 작품명, 반복 표현 포함)"],
      "type": "talk | game | mixed | silence"
    }}
  ],
  "glossary_candidates": [
    {{"term": "처음 보는 고유명사/닉네임/반복 표현", "context": "등장한 맥락 한 문장", "guess_type": "닉네임 | 밈 | 인물 | 게임용어 | 기타", "time": "hh:mm:ss"}}
  ],
  "uncertain_points": ["오인식이 의심되거나 확신이 없는 부분 (시각 포함)"]
}}

규칙:
- 구간은 약 5분 단위로 나누되 주제가 바뀌는 지점을 우선하세요. 시각은 전사본의 시각을 그대로 사용하세요.
- 시청자 닉네임, 도네이션/TTS 낭독, 채팅 낭독은 스트리머 본인의 발언이 아닙니다. 발화 주체가 불확실하면 "시청자 채팅 또는 도네이션으로 추정"처럼 표시하세요.
- 전사본에 없는 내용을 추측해서 쓰지 마세요.
- 아래 용어집에 있는 용어는 그 설명을 따르세요.

[용어집]
{gloss_text}

[전사본]
{transcript}
"""
    model, text = generate(
        client,
        [prompt_sum],
        types.GenerateContentConfig(response_mime_type="application/json"),
    )
    with open(os.path.join(out_dir, "summary.raw.json"), "w", encoding="utf-8") as fh:
        fh.write(text)

    # 3) Report
    lines = [f"# 요약 테스트 결과 - Groq Whisper + Gemini 텍스트 (요약 모델: {model})", ""]
    lines += [
        "## 측정값",
        f"- Groq 모델: {GROQ_MODEL}, 전사 소요 {groq_seconds:.0f}초, 전사 줄 수 {len(segments)}, 글자 수 {len(transcript)}",
        f"- Gemini 토큰 사용: {json.dumps(USAGE, ensure_ascii=False)}",
        "",
    ]
    try:
        data = json.loads(text)
        lines += ["## 전체 요약", data.get("overall_summary", ""), ""]
        lines += ["## 키워드", ", ".join(data.get("keywords", [])), ""]
        lines += ["## 구간별 요약"]
        for s in data.get("segments", []):
            lines += [
                f"### [{s.get('start')} ~ {s.get('end')}] {s.get('title')} ({s.get('type')})",
                s.get("summary", ""),
                "키워드: " + ", ".join(s.get("keywords", [])),
                "검색어: " + ", ".join(s.get("search_terms", [])),
                "",
            ]
        if data.get("glossary_candidates"):
            lines += ["## 용어집 후보"]
            for g in data["glossary_candidates"]:
                lines.append(
                    f"- [{g.get('time')}] {g.get('term')} ({g.get('guess_type')}): {g.get('context')}"
                )
            lines.append("")
        if data.get("uncertain_points"):
            lines += ["## 불확실한 부분"] + [f"- {u}" for u in data["uncertain_points"]] + [""]
    except json.JSONDecodeError:
        lines += ["(요약 JSON 파싱 실패 - summary.raw.json 참고)", ""]

    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    with open(os.path.join(out_dir, "usage.json"), "w", encoding="utf-8") as fh:
        json.dump({"groq_seconds": groq_seconds, "gemini": USAGE}, fh, ensure_ascii=False)
    print("Done.")


if __name__ == "__main__":
    main()
