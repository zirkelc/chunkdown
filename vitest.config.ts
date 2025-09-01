import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // enabled: true,
      // json-summary is required for https://github.com/davelosert/vitest-coverage-report-action
      reporter: ['json-summary', 'json', 'text-summary'],
    },
  },
});
