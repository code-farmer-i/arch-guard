import { canonical, deps } from '../../es/index.js'

/**
 * 场景：项目把 `JSON.parse(JSON.stringify(x))` 收进 `shared/lib/clone.ts` 当**唯一**深拷贝出口 ——
 * 它自己认可这个封装，不想再被"手搓深拷贝"提示。
 *
 * `deps({ fingerprints: [{ capability: 'deep-clone', removeSyntax: [...] }] })` 覆盖后：
 *   - `shared/lib/clone.ts` 不再报（项目显式放宽了这一条形态）；
 *   - `shared/lib/dates.ts` 里手搓日期格式化**照旧报**（覆盖只作用于声明的那个能力，
 *     而且首选方案仍来自 capabilities）。
 */
export default {
  presets: [
    canonical(),
    deps({
      capabilities: { 'deep-clone': 'structuredClone', datetime: 'dayjs' },
      fingerprints: [
        { capability: 'deep-clone', removeSyntax: ['JSON\\.parse\\(\\s*JSON\\.stringify\\('] },
      ],
    }),
  ],
  overrides: { enable: ['P06'], ignore: ['arch.config.mjs', 'expect.json'] },
}
