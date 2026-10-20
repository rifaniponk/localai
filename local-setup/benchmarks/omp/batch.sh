#!/bin/sh
# batch.sh "LABEL1 LABEL2 ..." REP_START REP_END : interleaved reps so drift hits every variant alike
cd "$(dirname "$0")"
for rep in $(seq $2 $3); do
  for l in $1; do
    python3 -u run.py "$l" --rep-start "$rep" --reps 1
  done
done
