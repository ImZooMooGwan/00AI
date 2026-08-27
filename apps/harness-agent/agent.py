#!/usr/bin/env python3
"""00AI Harness local/internal runner with optional HASA inference.

The browser sends selected text documents to this process. Documents are parsed
and hashed locally. Only redacted evidence snippets are sent to HASA when an API
key is configured; the original files are never forwarded to HASA.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib import error, request as urlrequest

VERSION = "0.2.0"
MAX_BODY_BYTES = 12 * 1024 * 1024
DEFAULT_PORT = 43120
DEFAULT_HASA_BASE_URL = "https://open.hasa.re.kr/v1"
DEFAULT_HASA_MODEL = "exaone-4.0-32b"
DEFAULT_ORIGINS = {
    "https://harness.00ai.kr",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
}
STOP_WORDS = {
    "그리고", "하지만", "관련", "대해서", "대한", "문서", "첨부", "정리", "근거",
    "함께", "에서", "으로", "에게", "까지", "있는", "없는", "해주세요", "해줘",
    "이번", "최근",
}


def keywords_from(text: str) -> list[str]:
    tokens = re.findall(r"[가-힣A-Za-z0-9]{2,}", text.lower())
    return list(dict.fromkeys(token for token in tokens if token not in STOP_WORDS))[:24]


def evidence_from(name: str, text: str, keywords: list[str]) -> list[dict]:
    lines = [
        re.sub(r"\s+", " ", line).strip()
        for line in re.split(r"\r?\n|(?<=[.!?])\s+", text)
    ]
    found = []
    for index, line in enumerate(lines, start=1):
        if not 12 <= len(line) <= 500:
            continue
        lower = line.lower()
        hits = [word for word in keywords if word in lower]
        has_number = bool(re.search(r"\d[\d,.]*\s*(원|명|개|건|%|년|월|일)?", line))
        score = len(hits) * 4 + int(has_number)
        if score:
            found.append({"file": name, "line": index, "text": line, "hits": hits, "score": score})
    return sorted(found, key=lambda item: (-item["score"], item["line"]))[:10]


def redact(text: str) -> str:
    text = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL]", text)
    text = re.sub(r"(?<!\d)01[016789][ -]?\d{3,4}[ -]?\d{4}(?!\d)", "[PHONE]", text)
    text = re.sub(r"(?<!\d)\d{6}[ -]?[1-4]\d{6}(?!\d)", "[ID]", text)
    return text


def call_hasa(task: str, evidence: list[dict], config: dict) -> tuple[str | None, str | None]:
    api_key = config["hasa_api_key"]
    if not api_key:
        return None, None
    snippets = "\n".join(
        f"[{item['file']}:{item['line']}] {redact(item['text'])}"
        for item in evidence[:20]
    )
    if not snippets:
        return None, None
    payload = {
        "model": config["hasa_model"],
        "temperature": 0.2,
        "max_tokens": 1400,
        "messages": [
            {
                "role": "system",
                "content": (
                    "당신은 공공문서 검토 보조자다. 제공된 근거만 사용하고 사실, 계산, 추론, 제안을 "
                    "구분한다. 근거가 없으면 없다고 말하며 파일명과 문장 번호를 인용한다."
                ),
            },
            {
                "role": "user",
                "content": f"업무 요청:\n{task}\n\n비식별 근거 문장:\n{snippets}",
            },
        ],
    }
    endpoint = config["hasa_base_url"].rstrip("/") + "/chat/completions"
    req = urlrequest.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        return str(content).strip(), None
    except error.HTTPError as exc:
        return None, f"HASA HTTP {exc.code}"
    except Exception as exc:  # network and malformed-response errors
        return None, f"HASA 연결 실패: {type(exc).__name__}"


def build_markdown(result: dict) -> str:
    evidence = result["evidence"]
    evidence_lines = "\n".join(
        f"{index}. **{item['file']} · 문장 {item['line']}**  \n   {item['text']}"
        for index, item in enumerate(evidence, start=1)
    ) or "- 요청어와 직접 일치하는 근거 문장을 찾지 못했습니다."
    file_lines = "\n".join(
        f"- {doc['name']} · {doc['size']} bytes · SHA-256 `{doc['hash']}`"
        for doc in result["documents"]
    )
    ai_section = result.get("ai_summary") or "HASA 분석을 사용하지 않았습니다."
    return f"""# 00AI Harness 실행 결과

- 실행시각: {result['created_at']}
- 실행 ID: {result['id']}
- 실행기: {result['runner_mode']}
- HASA 모델: {result.get('hasa_model') or '미사용'}
- HASA 전송 범위: {'비식별 근거 문장' if result.get('hasa_used') else '0 B'}

## 업무 요청

{result['request']}

## HASA 분석

{ai_section}

## 로컬 확인 근거

{evidence_lines}

## 원본 파일 무결성

{file_lines}

> 최종 정책·법률 판단은 담당자가 원문을 재확인해야 합니다.
"""


def run_documents(payload: dict, config: dict) -> dict:
    task = str(payload.get("request", "")).strip()
    files = payload.get("files") or []
    if len(task) < 10:
        raise ValueError("업무 요청은 10자 이상이어야 합니다.")
    if not isinstance(files, list) or not files:
        raise ValueError("처리할 문서가 없습니다.")
    if len(files) > 30:
        raise ValueError("문서는 최대 30개까지 처리합니다.")

    keywords = keywords_from(task)
    documents = []
    evidence = []
    for item in files:
        name = os.path.basename(str(item.get("name", "document.txt")))[:180]
        content = str(item.get("content", ""))
        encoded = content.encode("utf-8")
        documents.append({
            "name": name,
            "size": len(encoded),
            "hash": hashlib.sha256(encoded).hexdigest(),
        })
        evidence.extend(evidence_from(name, content, keywords))
    evidence = sorted(evidence, key=lambda item: -item["score"])[:30]
    ai_summary, hasa_error = call_hasa(task, evidence, config)
    now = datetime.now(timezone.utc)
    result = {
        "id": "RUN-" + now.strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:6],
        "created_at": now.isoformat(),
        "request": task,
        "runner_mode": config["mode"],
        "keywords": keywords,
        "documents": documents,
        "evidence": evidence,
        "ai_summary": ai_summary,
        "hasa_used": bool(ai_summary),
        "hasa_model": config["hasa_model"] if ai_summary else None,
        "hasa_error": hasa_error,
    }
    result["markdown"] = build_markdown(result)
    return result


class HarnessHandler(BaseHTTPRequestHandler):
    server_version = f"00AIHarness/{VERSION}"

    @property
    def config(self) -> dict:
        return self.server.config  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _origin(self) -> str | None:
        origin = self.headers.get("Origin")
        return origin if origin in self.config["origins"] else None

    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        origin = self._origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _json(self, payload: dict, status: int = 200) -> None:
        self._headers(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _authorized(self) -> bool:
        expected = self.config["agent_token"]
        if not expected:
            return True
        return self.headers.get("Authorization") == f"Bearer {expected}"

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._headers(204)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") in {"", "/health", "/v1/health"}:
            if not self._authorized():
                return self._json({"status": "unauthorized"}, 401)
            return self._json({
                "status": "healthy",
                "service": "00ai-harness-agent",
                "version": VERSION,
                "mode": self.config["mode"],
                "hasa_configured": bool(self.config["hasa_api_key"]),
                "hasa_model": self.config["hasa_model"],
                "document_policy": "original-local; redacted-evidence-to-hasa",
            })
        self._json({"status": "not_found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/v1/runs":
            return self._json({"status": "not_found"}, 404)
        if not self._authorized():
            return self._json({"status": "unauthorized"}, 401)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > MAX_BODY_BYTES:
                raise ValueError("요청 크기는 12MB 이하여야 합니다.")
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            result = run_documents(payload, self.config)
            self._json({"status": "completed", "result": result})
        except (ValueError, json.JSONDecodeError) as exc:
            self._json({"status": "invalid_request", "message": str(exc)}, 400)
        except Exception as exc:
            self._json({"status": "error", "message": type(exc).__name__}, 500)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="00AI Harness PC/internal runner")
    parser.add_argument("--host", default="127.0.0.1", help="기본값은 이 PC에서만 접근 가능")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--mode", choices=["pc_agent", "internal_server"], default="pc_agent")
    parser.add_argument("--origin", action="append", default=[], help="추가 허용 웹 Origin")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    origins = DEFAULT_ORIGINS | set(args.origin)
    config = {
        "mode": args.mode,
        "origins": origins,
        "agent_token": os.getenv("HARNESS_AGENT_TOKEN", ""),
        "hasa_api_key": os.getenv("HASA_API_KEY", ""),
        "hasa_base_url": os.getenv("HASA_BASE_URL", DEFAULT_HASA_BASE_URL),
        "hasa_model": os.getenv("HASA_MODEL", DEFAULT_HASA_MODEL),
    }
    server = ThreadingHTTPServer((args.host, args.port), HarnessHandler)
    server.config = config  # type: ignore[attr-defined]
    print(f"00AI Harness agent {VERSION} · http://{args.host}:{args.port}")
    print(f"mode={args.mode} · HASA={'configured' if config['hasa_api_key'] else 'not configured'}")
    print("종료: Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
