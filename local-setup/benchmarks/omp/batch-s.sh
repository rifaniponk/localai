#!/bin/sh
# batch-s.sh "LABELS" REP_START REP_END : the long session task, interleaved
cd "$(dirname "$0")"
for rep in $(seq $2 $3); do
  for l in $1; do
    python3 -u run.py "$l" --tasks s-library-session --rep-start "$rep" --reps 1 --timeout 1800
  done
done
