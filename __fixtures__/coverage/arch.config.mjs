import { canonical, metrics } from '../../es/index.js'

export default {
  presets: [
    canonical(),
    metrics({
      coverage: {
        report: 'coverage-summary.json',
        perDirMin: { 'src/shared/lib/**': 90 },
        zeroAllow: [],
        ratchet: true,
        baselineFile: 'arch.coverage.json',
        mustCover: ['src/**'],
      },
      depsBudget: { runtime: 0 },
    }),
  ],
  overrides: {
    enable: ['M02', 'M03', 'M04', 'M06', 'M07'],
    ignore: ['arch.config.mjs', 'expect.json', 'coverage-summary.json', 'arch.coverage.json'],
  },
}
