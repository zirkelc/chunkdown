/**
 * The benchmark dataset, shared by both revisions. Plain strings only: nothing
 * built by the library under test may live here, since both sides import this
 * module once.
 *
 * Fixtures above `MAX_BYTES` are cut into parts of about equal size so that
 * one timed body stays short enough to exclude most garbage collections. Cuts
 * go before a heading line where one is near, else before a blank line, so
 * every part is still a real document.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', 'benchmarks', 'fixtures');
const MAX_BYTES = 64_000;

/** Offset of the best cut near `target`: a heading start, else a paragraph start. */
const findCut = (text: string, target: number): number => {
  const window = 8_000;
  let best = -1;
  let bestDistance = Infinity;
  const heading = /\n(?=#{1,6} )/g;
  heading.lastIndex = Math.max(0, target - window);
  for (let m = heading.exec(text); m && m.index < target + window; m = heading.exec(text)) {
    const distance = Math.abs(m.index - target);
    if (distance < bestDistance) {
      best = m.index + 1;
      bestDistance = distance;
    }
  }
  if (best !== -1) return best;
  const blank = text.indexOf('\n\n', target);
  return blank === -1 ? text.length : blank + 2;
};

const split = (text: string): Array<string> => {
  const parts = Math.ceil(text.length / MAX_BYTES);
  if (parts === 1) return [text];
  const result: Array<string> = [];
  let start = 0;
  for (let i = 1; i < parts; i++) {
    const cut = findCut(text, Math.round((text.length * i) / parts));
    result.push(text.slice(start, cut));
    start = cut;
  }
  result.push(text.slice(start));
  return result;
};

export const FIXTURES: Array<{ name: string; text: string }> = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith('.md'))
  .sort()
  .flatMap((file) => {
    const name = file.replace(/\.md$/, '');
    const parts = split(fs.readFileSync(path.join(DIR, file), 'utf8'));
    return parts.length === 1 ? [{ name, text: parts[0] }] : parts.map((text, i) => ({ name: `${name}#${i + 1}`, text }));
  });
