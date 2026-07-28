import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SplitterOptions } from '../src/types';

export const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

export type Fixture = {
  /** File name without extension */
  name: string;
  /** Raw markdown content */
  text: string;
  /** Byte length of the content */
  bytes: number;
};

/**
 * Load every markdown fixture from the dataset directory, sorted by name so
 * benchmark runs are comparable across invocations.
 */
export const loadFixtures = (): Array<Fixture> => {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const text = readFileSync(join(FIXTURES_DIR, file), 'utf8');
      return { name: file.replace(/\.md$/, ''), text, bytes: Buffer.byteLength(text) };
    });
};

export type Preset = {
  /** Stable identifier used in benchmark names and snapshot keys */
  id: string;
  chunkSize: number;
  maxOverflowRatio: number;
};

const CHUNK_SIZES = [100, 250, 500, 1_000] as const;
const OVERFLOW_RATIOS = [1.0, 1.5] as const;

/**
 * Cartesian product of chunk sizes and overflow ratios.
 */
export const PRESETS: Array<Preset> = OVERFLOW_RATIOS.flatMap((maxOverflowRatio) =>
  CHUNK_SIZES.map((chunkSize) => ({
    id: `cs${chunkSize}-r${maxOverflowRatio.toFixed(1)}`,
    chunkSize,
    maxOverflowRatio,
  })),
);

export const presetOptions = (preset: Preset): SplitterOptions => ({
  chunkSize: preset.chunkSize,
  maxOverflowRatio: preset.maxOverflowRatio,
});
