/**
 * `arch-guard init` 生成配置时用到的**片段表**（R-106，纯数据）。
 *
 * 为什么在 `data/`：P4「库名只许出现在数据表与适配器面」—— 生成器里出现 `antd` / `i18next`
 * 这类库名会被自检拦下，而它们本来就该是一份可替换的清单（换 kit 只改这里）。
 */
export const INIT_SNIPPETS = {
  /** 生成物的 import 来源：换包名只改这一处 */
  packageName: '@arch-guard/core',
  /** 每个选择对应 preset 调用 + 它带来的依赖 */
  choices: {
    'ui-kit:antd': {
      preset: 'uiKit(antdKit()),',
      imports: ['antdKit'],
      packages: ['antd', '@ant-design/icons'],
    },
    'ui-kit:none': {
      preset: 'uiKit(noneKit()), // 换成 antdKit() 之类的适配器即可（换库只改这一行）',
      imports: ['noneKit'],
      packages: [],
    },
    'i18n:i18next': {
      preset: "i18n(i18nextKit({ resourceDir: 'src/shared/i18n/locales', languages: __LANGS__ })),",
      imports: ['i18n', 'i18nextKit'],
      packages: ['i18next', 'react-i18next'],
    },
    'data-layer:react-query': {
      preset:
        "dataLayer(reactQueryKit({ queryKeyFrom: ['src/modules/*/model/query.ts'], fetchIn: ['src/modules/*/hooks/**'] })),",
      imports: ['dataLayer', 'reactQueryKit'],
      packages: ['@tanstack/react-query'],
    },
  },
  /** 每个范式生成什么（库范式没有应用槽位，注释也不同） */
  paradigms: {
    canonical: { preset: 'canonical(),', imports: ['canonical'], note: '' },
    fsd: { preset: 'fsd(),', imports: ['fsd'], note: '' },
    library: {
      preset: 'library(),',
      imports: ['library'],
      note: '    // 库范式：把你自己的目录逐条声明进 overrides.structure.modules\n',
    },
  },
  /** 每个项目都会带的域预设与骨架 */
  base: {
    presets: [
      'designSystem(), // 落点由范式给；刻度白名单 / 对比度组合按需在括号里加',
      'copy(),',
      'hygiene(),',
    ],
    imports: ['copy', 'designSystem', 'hygiene', 'metrics', 'reactPack'],
    packages: ['react', 'react-dom'],
    metrics:
      `metrics({\n` +
      `      // 覆盖率那几条要一份"比最近一次提交还新"的产物 —— 先不声明，等 CI 里真跑起来再加\n` +
      `      tests: {\n` +
      `        requireTestsFor: ['src/shared/lib/**'],\n` +
      `        testGlobs: ['src/**/*.test.ts'],\n` +
      `        checkChain: { script: 'check', require: ['test', 'coverage'] },\n` +
      `      },\n` +
      `    }),`,
  },
} as const
