#!/usr/bin/env bash

# Vercel Ignored Build Step.
# Exit 0 => skip deployment.
# Exit 1 => continue deployment.
#
# Global cost-safety rules:
# - main always builds.
# - If the current commit diff cannot be inspected, build.
# - Any runtime/config/source change builds.
# - Only pure research/docs/CI changes may skip preview builds.

set -u

if [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  exit 1
fi

if ! changed_files="$(git diff --name-only HEAD^ HEAD 2>/dev/null)"; then
  exit 1
fi

if [ -z "$changed_files" ]; then
  exit 1
fi

while IFS= read -r path; do
  case "$path" in
    .github/*|docs/research/*|artifacts/research/*|scripts/research/*)
      ;;
    *)
      exit 1
      ;;
  esac
done <<< "$changed_files"

exit 0
