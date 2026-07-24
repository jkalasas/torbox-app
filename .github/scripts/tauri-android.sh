#!/usr/bin/env bash
set -euo pipefail

bun tauri "$@"

if [[ "${1:-}" == "android" && "${2:-}" == "build" ]]; then
  (
    cd src-tauri/gen/android
    ./gradlew \
      assembleUniversalRelease \
      assembleArm64Release \
      assembleArmRelease \
      assembleX86Release \
      assembleX86_64Release \
      --warn
  )
fi
