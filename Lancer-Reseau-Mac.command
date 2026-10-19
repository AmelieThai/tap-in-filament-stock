#!/bin/zsh
cd "$(dirname "$0")"
if ! .venv/bin/python -c "import cryptography" >/dev/null 2>&1; then
  PIP_USE_DEPRECATED=legacy-certs python3 -m venv .venv || exit 1
  PIP_USE_DEPRECATED=legacy-certs .venv/bin/python -m pip install -r requirements.txt || exit 1
fi
.venv/bin/python server.py
