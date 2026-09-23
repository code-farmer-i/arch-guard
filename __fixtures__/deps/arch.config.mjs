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

  // P03（幽灵依赖）/ P08（声明但未使用）按 docs/DESIGN.md §4.9 委派给 knip · depcheck，本体不实现
  overrides: { enable: ['P01', 'P02', 'P06'] },
}
