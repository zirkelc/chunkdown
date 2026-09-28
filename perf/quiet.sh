#!/bin/sh
# Waits for a quiet machine, then runs a harness command.
#
#   sh perf/quiet.sh node --import tsx perf/ab.mts HEAD~1 HEAD
#
# The wait is the half that has to happen before the command, which is why it is a wrapper and not
# part of ab.mts: a measurement command that blocks for an hour is a surprise. The check afterwards
# is built into ab.mts, which prints its own verdict.
#
# A run whose machine was busy is not data. Log it as INVALID and repeat it.
#
# On a machine that never reaches the default spread, raise it here (--max 5), record the value in
# the plan, and expect the keep bar to rise with it.
#
# The probe prints one line a minute while it waits, and those lines are the point: on a shared
# machine the waiting can be most of the session, and one wait in this method's history lasted 58
# minutes. Do not pipe them into `tail`, which hides them until the wait is already over.
set -e
cd "$(git rev-parse --show-toplevel)"
node perf/jitter.mts --max 2 --wait 60
start=$(date +%s)
"$@"
status=$?
echo "run took $(( $(date +%s) - start ))s"
exit $status
