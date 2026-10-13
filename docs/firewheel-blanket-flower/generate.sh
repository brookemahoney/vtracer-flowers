#!/usr/bin/env bash
# Generator for the Vtracer SVG Style Gallery (Plan 04) — Firewheel Blanket Flower
#
# AGENTS.md mandates these vtracer options for EVERY run:
#   --mode spline --clustering watershed --simplify 2.5 --path-precision 0 --hierarchical cutout
# and bounds: --watershed-detail in (100, 256); --max-colors > 15.
#
# Empirically verified effective variety axes on THIS source image:
#   - --watershed-detail  (region granularity; only axis that changes structure)
#   - --max-colors        (color richness; distinct at every watershed-detail)
# Inert axes (byte-identical output regardless of value here): --color-precision,
# --gradient-step, --filter-speckle, --optimize. They are held FIXED (varying them
# would only produce duplicate SVGs — the cause of "all look the same").
#
# Grid: max-colors in {16,32,48,64} x watershed-detail in {101,106,...,221} = 100
# distinct SVGs, each <= ~300 KB (safety margin under the 300 KB ceiling).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC="$ROOT/private/IMG_2722 - Firewheel Blanket Flower.jpeg"
OUTDIR="$ROOT/web/firewheel-blanket-flower/images"
MANIFEST="$OUTDIR/manifest.json"
SIZE_LIMIT=300000   # 300 KB ceiling (revised requirement)

mkdir -p "$OUTDIR"

# AGENTS.md-mandated base (always applied)
BASE=(--mode spline --clustering watershed --simplify 2.5 --path-precision 0 --hierarchical cutout)
# Inert, fixed options (kept for an honest settings string)
FIX=(--color-precision 4 --gradient-step 32 --filter-speckle 2 --optimize 2)

# Effective variety axes
MAX_COLORS=(16 32 48 64)                  # all > 15 (AGENTS.md boundary); 4 color richness levels
WATERSHED_DETAIL=( $(seq 101 5 221) )      # 25 values in (100,256): 101,106,...,221

# 25 x 4 = 100 distinct combinations; for each watershed-detail emit all 4 color depths.
combos=()
for wd in "${WATERSHED_DETAIL[@]}"; do
  for mc in "${MAX_COLORS[@]}"; do
    combos+=("$mc:$wd")
  done
done
total=${#combos[@]}

manifest_entries="$(mktemp)"
idx=1; fallbacks=0; max_size=0

while IFS=: read -r mc wd; do
  n="$(printf 'img-%03d.svg' "$idx")"
  out="$OUTDIR/$n"
  settings="$(printf '%s %s --max-colors %s --watershed-detail %s' "${BASE[*]}" "${FIX[*]}" "$mc" "$wd")"

  vtracer --input "$SRC" --output "$out" "${BASE[@]}" "${FIX[@]}" \
          --max-colors "$mc" --watershed-detail "$wd" >/dev/null 2>&1
  sz="$(stat -c%s "$out")"

  # Safety net: regenerate with the smallest settings on the mandated base.
  if (( sz > SIZE_LIMIT )); then
    attempt=0
    while (( sz > SIZE_LIMIT )); do
      settings="$(printf '%s --max-colors 16 --color-precision 4 --gradient-step 32 --filter-speckle 16 --watershed-detail 101 --optimize 2' "${BASE[*]}")"
      vtracer --input "$SRC" --output "$out" "${BASE[@]}" \
              --max-colors 16 --color-precision 4 --gradient-step 32 --filter-speckle 16 \
              --watershed-detail 101 --optimize 2 >/dev/null 2>&1
      sz="$(stat -c%s "$out")"
      attempt=$((attempt + 1)); (( attempt > 8 )) && break
    done
    fallbacks=$((fallbacks + 1))
  fi

  (( sz > max_size )) && max_size=$sz
  printf '  "%s": { "size_bytes": %s, "settings": "%s" }\n' "$n" "$sz" "$settings" >> "$manifest_entries"
  printf '  [%03d/%d] %s -> %s bytes (max-colors=%s watershed-detail=%s)\n' "$idx" "$total" "$n" "$sz" "$mc" "$wd"
  idx=$((idx + 1))
done < <(printf '%s\n' "${combos[@]}")

# --- Assemble manifest.json (ordered object) ---
{
  printf '{\n'
  awk 'NR>1{printf ",\n"} {print}' "$manifest_entries"
  printf '\n}\n'
} > "$MANIFEST"
rm -f "$manifest_entries"

echo "----------------------------------------"
echo "Generated: $total SVGs in $OUTDIR"
echo "Fallback regenerations: $fallbacks"
echo "Max file size: $max_size bytes (limit $SIZE_LIMIT)"
echo "Distinct sizes: $(find "$OUTDIR" -name 'img-*.svg' -printf '%s\n' | sort -u | wc -l) / $total"
echo "Manifest entries: $(python3 -c "import json;print(len(json.load(open('$MANIFEST'))))" 2>/dev/null || echo unknown)"
echo "All files <= ${SIZE_LIMIT}bytes: $(python3 -c "import json;d=json.load(open('$MANIFEST'));print(all(v['size_bytes']<=${SIZE_LIMIT} for v in d.values()))" 2>/dev/null || echo unknown)"
