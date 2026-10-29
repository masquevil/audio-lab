#!/bin/bash

set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain)" ]]; then
  echo '工作区不干净，请先检查并提交改动。' >&2
  exit 1
fi
git push origin HEAD:deploy
