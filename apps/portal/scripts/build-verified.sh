#!/usr/bin/env bash
# Cloudflare CI: run nested scripts through bash so file mode never blocks builds.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

# Build 직전에 공개 Sites와 GitHub 저장소를 읽어 exact Custom Domain 목록을 만듭니다.
# Cloudflare Custom Domain은 배포 시 DNS 레코드와 TLS 인증서를 함께 생성합니다.
echo "Preparing 00AI service subdomains..."
node "${script_dir}/generate-domain-routes.mjs"

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

bash "${script_dir}/validate-artifact.sh"
