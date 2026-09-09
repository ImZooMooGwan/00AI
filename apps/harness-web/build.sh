#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
dist_dir="$script_dir/dist"

case "$dist_dir" in
  */apps/harness-web/dist) ;;
  *) echo "Refusing to replace unexpected build directory: $dist_dir" >&2; exit 1 ;;
esac

rm -rf "$dist_dir"
mkdir -p "$dist_dir/apps"

assets=(
  index.html
  styles.css
  app.js
  harness-app-v2.js
  harness-app-v3.js
  harness-app-v4.js
  harness-app-v5.js
  harness-workspace.css
  harness-functional.css
  harness-runner-v2.css
  harness-runner-v3.css
  harness-runner-v4.css
)

for asset in "${assets[@]}"; do
  cp "$repo_root/$asset" "$dist_dir/$asset"
done

cp -R "$repo_root/apps/portal/public/fonts" "$dist_dir/fonts"
mkdir -p "$dist_dir/apps/harness-agent"
for agent_asset in agent.py README.md .env.example install-windows.ps1 start-windows.ps1 run-installed-agent.ps1 uninstall-windows.ps1 start-server.sh; do
  cp "$repo_root/apps/harness-agent/$agent_asset" "$dist_dir/apps/harness-agent/$agent_asset"
done
cp "$script_dir/_headers" "$dist_dir/_headers"

test -s "$dist_dir/index.html"
test -s "$dist_dir/harness-app-v4.js"
test -s "$dist_dir/apps/harness-agent/install-windows.ps1"
