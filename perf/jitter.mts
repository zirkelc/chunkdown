/**
 * Machine-readiness probe. Run it before you calibrate and before every confirmation run.
 *
 *   node --import tsx perf/jitter.mts [--repeats 40]
 *
 * Times the same pure CPU loop many times and reports the spread. The loop cannot become faster
 * than its true cost, so the spread is what the machine adds: other load, frequency changes, or a
 * scheduler that moves the process between cores of different speed (Apple silicon, big.LITTLE).
 * When p50 sits far above the minimum, the two sides of an A/B run sample different machine states
 * and per-case deltas become unusable.
 *
 * The probe decides, not the load average: the average lags by design and says nothing about which
 * core the process gets. Exit code 1 means "too busy", so this can gate a script.
 */
import * as os from "node:os";
import { parseArgs } from "node:util";
import { cpuProbe } from "./harness.mts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { repeats: { type: "string" }, max: { type: "string" }, wait: { type: "string" } },
});
const REPEATS = Number(values.repeats ?? 40);
/**
 * Measure below this spread. 5% still runs, but its numbers were not usable in practice. A machine
 * that never reaches the default (a shared machine, other agents) can be measured with a higher
 * `--max`, but then record the value in the plan and expect the keep bar to rise with it: the bar is
 * calibrated on the same machine as the experiments, so a noisier machine buys fewer decidable
 * experiments rather than looser ones.
 */
const MAX = Number(values.max ?? 2);
/** Minutes to keep probing for a quiet machine before giving up. */
const WAIT_MINUTES = values.wait === undefined ? 0 : Number(values.wait || 10);

const probe = () => cpuProbe(REPEATS);
const started = Date.now();
const deadline = started + WAIT_MINUTES * 60_000;
let result = probe();
/**
 * One line a minute while waiting, not one per probe. A probe takes a couple of seconds, so printing
 * each one turns an hour of waiting into a thousand identical lines, and printing none makes it look
 * like a hang: on a shared machine one wait in this method's history lasted 58 minutes.
 */
let lastReport = 0;
while (result.spread > MAX && Date.now() < deadline) {
  const waited = Date.now() - started;
  if (waited - lastReport >= 60_000 || lastReport === 0) {
    lastReport = waited;
    console.log(`busy after ${Math.round(waited / 60_000)} min: p50 ${result.spread.toFixed(1)}% above min, waiting for <= ${MAX}% (giving up at ${WAIT_MINUTES} min)`);
  }
  result = probe();
}

const [load1] = os.loadavg();
console.log(`cores ${os.cpus().length}, load average (1 min) ${load1.toFixed(2)}`);
console.log(`cpu loop: min ${result.min.toFixed(1)} ms, p50 ${result.p50.toFixed(1)} ms, max ${result.max.toFixed(1)} ms`);
console.log(`p50 is ${result.spread.toFixed(1)}% above min (threshold ${MAX}%)`);

if (result.spread > MAX) {
  console.log("BUSY: do not measure now. Wait, or say what is running.");
  process.exit(1);
}
console.log("OK: quiet enough to measure.");
