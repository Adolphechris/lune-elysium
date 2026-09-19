#!/usr/bin/env bash
# Simple alert sender via webhook (optional). Usage: send-alert.sh <webhook_url> <json-payload-file>
WEBHOOK="$1"
PAYLOAD_FILE="$2"
if [ -z "$WEBHOOK" ] || [ -z "$PAYLOAD_FILE" ]; then
  echo "Usage: $0 <webhook_url> <json-payload-file>"
  exit 1
fi
if command -v curl >/dev/null 2>&1; then
  curl -sS -X POST -H "Content-Type: application/json" -d @"$PAYLOAD_FILE" "$WEBHOOK" || true
else
  echo "curl not found, cannot send webhook"
fi
