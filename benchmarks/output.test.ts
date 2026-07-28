import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { chunkdown } from '../src/index';
import { loadFixtures, PRESETS, presetOptions } from './dataset';

/**
 * Output-stability guard for performance work.
 *
 * Every fixture is split under every preset and the result is reduced to a
 * chunk count plus a digest of the chunk texts and breadcrumbs. Any change to
 * splitting behaviour shows up as a snapshot diff, so an optimisation that
 * silently alters output cannot pass unnoticed.
 */
/** Separator that cannot occur in markdown, so joined parts stay unambiguous */
const NUL = '\u0000';

const digest = (parts: Array<string>): string =>
  createHash('sha256').update(parts.join(NUL)).digest('hex').slice(0, 16);

const fixtures = loadFixtures();

for (const preset of PRESETS) {
  describe(preset.id, () => {
    for (const fixture of fixtures) {
      test(fixture.name, () => {
        // Arrange
        const splitter = chunkdown(presetOptions(preset));

        // Act
        const { chunks } = splitter.split(fixture.text);

        // Assert
        expect({
          chunks: chunks.length,
          text: digest(chunks.map((c) => c.text)),
          breadcrumbs: digest(chunks.map((c) => c.breadcrumbs.map((b) => `${b.depth}:${b.text}`).join('>'))),
        }).toMatchSnapshot();
      });
    }
  });
}
