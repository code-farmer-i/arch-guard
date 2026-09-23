import { join } from 'node:path'

import { extractFacts } from './facts.js'
import type { Finding } from './types.js'
import { readText, relOf, walk } from './util.js'

/**
 * 本体自包含检查（见 docs/SPEC.md §15.2）：
 * P1 只依赖 node:* / 白名单第三方 / 本体内相对路径
 * P2 不得出现宿主项目字面量（宿主名、绝对路径）
 * P3 引擎层不得假设项目布局（engine/** 不许出现 'src/' 这类字符串字面量）
 *
 * 说明：只扫**字符串字面量**（注释里写这些词是合法的），并排除自检模块自身。
 */

/** 运行时依赖白名单：除 Node 内置与自身外，本体只允许这些 */
const ALLOWED_BARE_IMPORTS = new Set(['typescript', 'commander'])
/** 宿主项目名（换宿主时改这里；本体不该认识任何具体宿主） */
const HOST_MARKERS = ['superhive']
const SELF_FILE = 'src/engine/portability.ts'

export interface PortabilityResult {
  findings: Finding[]
  checked: number
}

export function checkPortability(packageRoot: string): PortabilityResult {
  const files = walk(join(packageRoot, 'src'), { extensions: ['.ts'] })
  const findings: Finding[] = []

  for (const file of files) {
    const rel = relOf(packageRoot, file)
    if (rel === SELF_FILE) continue
    const text = readText(file)
    const facts = extractFacts({ file, rel, role: 'tool', text })

    /* P1 依赖白名单 */
    for (const imported of facts.imports) {
      const spec = imported.spec
      if (spec.startsWith('./') || spec.startsWith('../')) continue
      if (spec.startsWith('node:') || ALLOWED_BARE_IMPORTS.has(spec)) continue
      findings.push({
        rule: 'P1',
        file: rel,
        line: imported.line,
        text: `本体只许依赖 node:* 与白名单依赖，出现了：${spec}`,
        hint: '要把能力带进本体，请把它变成本体内的实现或适配器数据；新增运行时依赖需写进 package.json 并同步白名单',
        global: true,
      })
    }

    /* P2 / P3 只看字符串字面量 */
    for (const literal of facts.strings) {
      for (const marker of HOST_MARKERS) {
        if (!literal.value.includes(marker)) continue
        findings.push({
          rule: 'P2',
          file: rel,
          line: literal.line,
          text: `本体里出现宿主项目字面量：${marker}`,
          hint: '宿主相关的东西只能出现在宿主的 arch.config.mjs',
          global: true,
        })
      }
      if (literal.value.includes('/Users/')) {
        findings.push({ rule: 'P2', file: rel, line: literal.line, text: '本体里出现绝对路径', global: true })
      }
      if (rel.startsWith('src/engine/') && literal.value.startsWith('src/')) {
        findings.push({
          rule: 'P3',
          file: rel,
          line: literal.line,
          text: "引擎层不得硬编码 'src/' 布局（布局由预设/配置给出）",
          global: true,
        })
      }
    }
  }

  return { findings, checked: files.length }
}
