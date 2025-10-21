import { defineConfig } from 'tsdown';

export default defineConfig({
  /**
   * Run arethetypeswrong after bundling.
   * Requires @arethetypeswrong/core to be installed.
   */
  attw: {
    profile: 'esmOnly',
    entrypoints: ['.']
  },
  publint: true,
    exports: true,
  format: ['esm'],
});
