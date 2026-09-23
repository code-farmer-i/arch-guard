import { canonical, hygiene, deps } from '../../es/index.js'

export default {
  presets: [
    canonical(),
    hygiene(),
    deps({
      allow: ['commander'],
      deny: ['axios'],
      capabilities: {
        'cli-args': 'commander',
        // 平台内置能力：不需要出现在 allow 里
        'deep-clone': 'structuredClone',
      },
    }),
  ],

  overrides: { enable: ['P01', 'P02', 'P03', 'P06', 'P08'] },
}
