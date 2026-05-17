#!/usr/bin/env bash
# Convert the latest deep feature audit report (.md) to .docx.
#
# Strategy:
#   1. Use pandoc if available (preferred — best fidelity).
#   2. Fall back to python + python-docx + markdown (basic conversion).
#
# Usage:
#   bash scripts/export-audit-docx.sh
#   bash scripts/export-audit-docx.sh path/to/report.md
#
# The output .docx is written next to the input .md.

set -euo pipefail

INPUT="${1:-docs/audits/XUANTOI_DEEP_FEATURE_AUDIT_2026_05_17.md}"

if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

OUTPUT="${INPUT%.md}.docx"

if command -v pandoc >/dev/null 2>&1; then
  echo "Using pandoc to convert $INPUT -> $OUTPUT"
  pandoc -f gfm -t docx -o "$OUTPUT" "$INPUT"
  echo "Wrote $OUTPUT"
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import docx" >/dev/null 2>&1; then
    echo "pandoc not found; falling back to python-docx"
    python3 "$(dirname "$0")/export-audit-docx.py" "$INPUT" "$OUTPUT"
    exit 0
  fi
fi

cat <<EOF >&2
ERROR: neither pandoc nor python-docx is installed.

Install one of:
  - pandoc:        https://pandoc.org/installing.html
  - python-docx:   pip install python-docx markdown

Then re-run: bash scripts/export-audit-docx.sh
EOF
exit 2
