"""Summarize a CHZZK VOD clip with Gemini (audio) and classify frames (images).

Usage:
    python scripts/summarize.py <audio_path> <frames_dir> <out_dir> <start_sec> <frame_interval_sec>

Reads the API key from the SUMMARY_API environment variable.
"""
import glob
import json
import os
import sys
import time

from google import genai
from google.genai import types

DEFAULT_MODELS = ["gemini-2.5-flash"]
USAGE = []  # token usage per successful call


def fmt(sec: int) -> str:
    sec = int(sec)
    return f"{sec // 3600:02d}:{(sec % 3600) // 60:02d}:{sec % 60:02d}"


def get_client() -> genai.Client:
    key = (os.environ.get("GEMINI_API") or os.environ.get("SUMMARY_API") or "").strip()
    if not key:
        print("ERROR: GEMINI_API secret is empty or not registered as a repository secret.")
        sys.exit(1)
    print(f"API key loaded (length={len(key)}).")
    return genai.Client(api_key=key)


def candidate_models(client: genai.Client) -> list[str]:
    env_model = os.environ.get("GEMINI_MODEL", "").strip()
    if env_model:
        return [env_model]
    return list(DEFAULT_MODELS)


def discover_models(client: genai.Client) -> list[str]:
    names = []
    try:
        for m in client.models.list():
            actions = getattr(m, "supported_actions", None) or []
            name = (m.name or "").replace("models/", "")
            if "generateContent" in actions and "flash" in name:
                names.append(name)
    except Exception as e:  # noqa: BLE001
        print(f"Could not list models: {e}")
    names = sorted(set(names), reverse=True)
    print("Available flash models:", names)
    return names


def generate(client, contents, config=None):
    """Try preferred model(s); if not found, fall back to discovered flash models."""
    tried = []
    models = candidate_models(client)
    for attempt in range(2):
        for model in models:
            if model in tried:
                continue
            tried.append(model)
            for retry in range(3):
                try:
                    print(f"Calling model: {model}")
                    resp = client.models.generate_content(
                        model=model, contents=contents, config=config
                    )
                    um = getattr(resp, "usage_metadata", None)
                    if um:
                        USAGE.append({
                            "model": model,
                            "prompt": getattr(um, "prompt_token_count", None),
                            "output": getattr(um, "candidates_token_count", None),
                            "thoughts": getattr(um, "thoughts_token_count", None),
                            "total": getattr(um, "total_token_count", None),
                        })
                    return model, resp.text
                except Exception as e:  # noqa: BLE001
                    msg = str(e)
                    print(f"Model {model} error: {msg[:300]}")
                    if "404" in msg or "NOT_FOUND" in msg:
                        break  # try another model
                    if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "503" in msg:
                        wait = 30 * (retry + 1)
                        print(f"Rate limited / busy. Waiting {wait}s...")
                        time.sleep(wait)
                        continue
                    raise
        if attempt == 0:
            models = discover_models(client)
    raise RuntimeError("No working model found.")


def summarize_audio(client, audio_path, start_sec):
    print(f"Uploading audio: {audio_path}")
    f = client.files.upload(file=audio_path, config={"mime_type": "audio/mpeg"})
    while f.state and f.state.name == "PROCESSING":
        time.sleep(3)
        f = client.files.get(name=f.name)
    if f.state and f.state.name == "FAILED":
        raise RuntimeError("Audio file processing failed.")

    prompt = f"""당신은 한국어 인터넷 방송(치지직) 다시보기를 정리하는 분석가입니다.
첨부된 음성은 방송의 일부 구간이며, 음성 안의 시간(00:00:00)은 방송 전체 기준으로 {fmt(start_sec)}부터 시작합니다.
아래 JSON 형식으로만 답하세요. 다른 설명은 쓰지 마세요.

{{
  "overall_summary": "전체 요약 3~5문장",
  "keywords": ["핵심 키워드 최대 10개"],
  "segments": [
    {{
      "start": "음성 기준 mm:ss",
      "end": "음성 기준 mm:ss",
      "title": "구간 한 줄 제목",
      "summary": "이 구간에서 나온 이야기 2~4문장",
      "keywords": ["구간 키워드 3~5개"],
      "type": "talk | game | mixed | silence"
    }}
  ],
  "uncertain_points": ["잘 안 들리거나 확신이 없는 부분"]
}}

규칙:
- 구간은 약 5분 단위로 나누되 주제가 바뀌는 지점을 우선하세요.
- 들리지 않은 내용을 추측해서 쓰지 마세요. 불확실하면 uncertain_points에 적으세요.
- 고유명사, 게임명, 시청자 닉네임은 들린 그대로 적고 확신이 없으면 표시하세요.
"""
    model, text = generate(
        client,
        [f, prompt],
        types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return model, text


def classify_frames(client, frames_dir, start_sec, interval):
    paths = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))
    if not paths:
        return None, "[]"
    parts = []
    for i, p in enumerate(paths):
        t = start_sec + i * interval
        parts.append(f"프레임 {i + 1} (방송 시각 {fmt(t)})")
        with open(p, "rb") as fh:
            parts.append(types.Part.from_bytes(data=fh.read(), mime_type="image/jpeg"))
    prompt = """위 프레임들은 한국어 인터넷 방송 화면을 일정 간격으로 캡처한 것입니다.
각 프레임을 분석해 아래 JSON 배열로만 답하세요. 다른 설명은 쓰지 마세요.

[
  {
    "frame": 프레임 번호,
    "time": "방송 시각",
    "type": "talk | game | other",
    "game_name": "게임이면 게임명, 모르면 null",
    "scene": "화면에 보이는 내용 한 문장",
    "is_key_scene": true 또는 false,
    "reason": "핵심 장면이면 이유 한 문장, 아니면 빈 문자열"
  }
]

규칙:
- 화면에 보이는 것만 근거로 하세요. 추측은 하지 마세요.
- 게임명은 화면 UI나 텍스트로 확인될 때만 적으세요.
- 핵심 장면은 전체의 20% 이하로 고르세요.
"""
    parts.append(prompt)
    model, text = generate(
        client, parts, types.GenerateContentConfig(response_mime_type="application/json")
    )
    return model, text


def main():
    audio_path, frames_dir, out_dir, start_sec, interval = sys.argv[1:6]
    start_sec, interval = int(start_sec), int(interval)
    os.makedirs(out_dir, exist_ok=True)
    client = get_client()

    # Quick key check with a tiny request so failures are obvious.
    model, ping = generate(client, ["한 단어로 '확인'이라고만 답하세요."])
    print(f"Key check OK with model {model}: {ping.strip()[:20]}")

    m1, audio_json = summarize_audio(client, audio_path, start_sec)
    with open(os.path.join(out_dir, "audio_summary.raw.json"), "w", encoding="utf-8") as fh:
        fh.write(audio_json)

    m2, frame_json = classify_frames(client, frames_dir, start_sec, interval)
    with open(os.path.join(out_dir, "frames.raw.json"), "w", encoding="utf-8") as fh:
        fh.write(frame_json)

    # Build a readable markdown report.
    lines = [f"# 요약 테스트 결과 (모델: {m1})", ""]
    try:
        data = json.loads(audio_json)
        lines += ["## 전체 요약", data.get("overall_summary", ""), ""]
        lines += ["## 키워드", ", ".join(data.get("keywords", [])), ""]
        lines += ["## 구간별 요약"]
        for s in data.get("segments", []):
            lines += [
                f"### [{s.get('start')} ~ {s.get('end')}] {s.get('title')} ({s.get('type')})",
                s.get("summary", ""),
                "키워드: " + ", ".join(s.get("keywords", [])),
                "",
            ]
        if data.get("uncertain_points"):
            lines += ["## 불확실한 부분"] + [f"- {u}" for u in data["uncertain_points"]] + [""]
    except json.JSONDecodeError:
        lines += ["(음성 요약 JSON 파싱 실패 - audio_summary.raw.json 참고)", ""]

    try:
        frames = json.loads(frame_json)
        lines += [f"## 화면 분석 (모델: {m2})"]
        for fr in frames:
            mark = "★" if fr.get("is_key_scene") else " "
            lines.append(
                f"- {mark} 프레임 {fr.get('frame')} [{fr.get('time')}] "
                f"{fr.get('type')} / {fr.get('game_name')} - {fr.get('scene')}"
                + (f" (이유: {fr.get('reason')})" if fr.get("reason") else "")
            )
    except json.JSONDecodeError:
        lines += ["(프레임 분석 JSON 파싱 실패 - frames.raw.json 참고)"]

    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print("Done. Report written.")


if __name__ == "__main__":
    main()
