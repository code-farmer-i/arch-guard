import { deps, library, metrics } from '../es/index.js'

export default {
  specVersion: '1',
  presets: [
    library({ modules: { data: 1, engine: 2, packs: 4, presets: 4 }, entry: ['index.ts', 'cli.ts'] }),
    deps({ capabilities: { 'cli-args': 'commander' }, allow: ['commander'] }),
    metrics({
      tests: { checkChain: { script: 'check', require: ['test', 'coverage'] } },
      depsBudget: { runtime: 1 },
    }),
  ],
  overrides: {
    ignore: ['es/**', 'lib/**', 'bin/**', 'examples/**', '__fixtures__/**', '.scratch/**', 'pagoda.config.mjs', 'eslint.config.mjs'],
    exempt: [{ glob: 'src/engine/output.ts', reason: '门禁的唯一输出出口' }],
  },
}
