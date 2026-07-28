import { bench, describe } from 'vitest';
import { chunkdown } from '../src/index';
import { type Fixture, loadFixtures, PRESETS, presetOptions } from './dataset';

const fixtures: Array<Fixture> = loadFixtures();

/**
 * One suite per preset, one benchmark per fixture.
 * Splitter instances are created once and reused: they hold no per-run state,
 * so construction cost stays out of the measurement.
 */
for (const preset of PRESETS) {
  describe(preset.id, () => {
    const splitter = chunkdown(presetOptions(preset));

    for (const fixture of fixtures) {
      bench(fixture.name, () => {
        splitter.split(fixture.text);
      });
    }
  });
}
