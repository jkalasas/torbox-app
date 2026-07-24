#!/usr/bin/env bash
set -euo pipefail

bun tauri "$@"

if [[ "${1:-}" != "android" || "${2:-}" != "build" ]]; then
  exit 0
fi

# Tauri only packages universal OR per-ABI in one run. Build the other set too.
# A second full `tauri android build` restarts the CLI options server that Gradle
# needs; re-running gradlew alone after the first command fails with
# "Connection refused" on android-studio-script.
if [[ "$*" == *"--split-per-abi"* ]]; then
  bun tauri android build --apk
else
  bun tauri android build --apk --split-per-abi
fi
