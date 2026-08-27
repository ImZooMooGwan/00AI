#!/usr/bin/env sh
set -eu
: "${HASA_API_KEY:?HASA_API_KEY 환경변수를 먼저 설정하세요.}"
exec python3 "$(dirname "$0")/agent.py" --mode internal_server --host 0.0.0.0 "$@"
