#!/usr/bin/env bash
set -euo pipefail

echo "==> Cleaning macOS junk"
find . -name ".DS_Store" -delete || true

echo "==> Ensuring common folders exist"
mkdir -p deployments

echo "==> Ensure .nvmrc exists (Hardhat stable)"
if [ ! -f .nvmrc ]; then
  echo "20" > .nvmrc
fi

echo "==> Done. If git repo exists, show status"
if [ -d .git ]; then
  git status || true
else
  echo "(not a git repo yet)"
fi