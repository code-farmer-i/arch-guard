import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface InitOptions {
  paradigm?: string
  ui?: string
  data?: string
  i18n?: string
  langs?: string
  out?: string
  force?: boolean
}

import { INIT_SNIPPETS } from '../data/init-template.js'

const PARADIGMS = new Set(['canonical', 'fsd', 'library'])

/**
 * `arch-guard init`：按**选择**生成一份填好落点的起点配置（R-106）。
 *
 * 为什么要有它：配置有 100+ 条规则、29 个能力根，用户真正要回答的只有两个问题 ——
 * 「我用哪个范式」+「我用哪些库」；其余（库的默认事实、平台表、范式自带的落点）都该由工具给。
 * 生成物**必须能通过 `loadConfig`**（测试里就这么断言）—— 一段好看但加载不了的模板没有意义。
 */
export function initConfig(options: InitOptions = {}): string {
  const paradigm = PARADIGMS.has(options.paradigm ?? '')
    ? (options.paradigm as string)
    : 'canonical'
  const ui = options.ui === 'antd' ? 'antd' : 'none'
  const data = options.data === 'react-query' ? 'react-query' : 'none'
  const i18n = options.i18n === 'i18next' ? 'i18next' : 'none'
  const languages = (options.langs ?? 'zh-CN,en')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

  const snippets = INIT_SNIPPETS
  const kind = snippets.paradigms[paradigm as keyof typeof snippets.paradigms]
  const imported = new Set<string>([...snippets.base.imports, ...kind.imports, 'deps', 'uiKit'])
  const presets: string[] = [kind.preset, ...snippets.base.presets]

  const allowed: string[] = [...snippets.base.packages]
  const add = (choice: {
    preset: string
    imports: readonly string[]
    packages: readonly string[]
  }): void => {
    presets.push(choice.preset.replace('__LANGS__', JSON.stringify(languages)))
    for (const name of choice.imports) imported.add(name)
    allowed.push(...choice.packages)
  }
  add(ui === 'antd' ? snippets.choices['ui-kit:antd'] : snippets.choices['ui-kit:none'])
  if (i18n === 'i18next') add(snippets.choices['i18n:i18next'])
  if (data === 'react-query') add(snippets.choices['data-layer:react-query'])
  presets.push(`deps({ allow: ${JSON.stringify(allowed.sort())}, unusedDeps: true }),`)
  presets.push(snippets.base.metrics)

  const imports = [...imported].sort().join(', ')
  return `/**
 * 由 \`arch-guard init\` 生成 —— **起点，不是终点**。
 *
 * 下一步：跑 \`pnpm exec arch-guard\`，看报告的停用清单 —— 它会给出"想要跑就写这一行"的片段，
 * 一行行补即可（渐进接入四步见 docs/USAGE.md §2）。终点形态可参考 examples/full 或 examples/full-fsd。
 */
import { ${imports} } from '${snippets.packageName}'

export default {
  specVersion: '1',
  packs: [reactPack],
  presets: [
${presets.map((line) => '    ' + line).join('\n')}
  ],
  overrides: {
    include: ['src/**'],
    // 结构声明（域隔离 / 公开面 / 阈值…）按项目的真实形态逐条加；范式已给一部分默认
    structure: {},
  },
}
`
}

/** 写文件（默认 `arch.config.mjs`）；已存在且没给 `--force` 时不覆盖，返回是否写入 */
export function writeInitConfig(
  options: InitOptions,
  cwd: string,
): { path: string; written: boolean } {
  const target = resolve(cwd, options.out ?? 'arch.config.mjs')
  if (existsSync(target) && options.force !== true) return { path: target, written: false }
  writeFileSync(target, initConfig(options))
  return { path: target, written: true }
}
