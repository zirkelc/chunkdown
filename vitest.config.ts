import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Worktrees are created under `.claude/worktrees/`, which is inside the
 * repository, so without this every test and benchmark in every worktree runs
 * alongside the ones in this checkout.
 */
const exclude = [...configDefaults.exclude, '.claude/**'];

export default defineConfig({
  test: {
    exclude,
    benchmark: {
      exclude,
    },
    coverage: {
      // enabled: true,
      // json-summary is required for https://github.com/davelosert/vitest-coverage-report-action
      reporter: ['json-summary', 'json', 'text-summary'],
    },
  },
});
