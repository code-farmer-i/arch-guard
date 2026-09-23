import type { Finding, Rule } from '../../../engine/types.js'

/** S00 解析失败必须报错：fail-closed —— 语法错误会让该文件失去全部检查，绝不能静默通过 */
export const parseFailClosed: Rule = {
  id: 'S00',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '解析失败必须报错',
  hint: '语法错误会让该文件失去全部检查，先修语法',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      return facts.parseErrors.map((error) => ({
        rule: 'S00',
        file: record.rel,
        line: error.line,
        text: `解析失败：${error.message}`,
        global: true,
      }))
    }),
}

const finding = (
  rule: string,
  file: string,
  line: number,
  text: string,
  hint?: string,
  global = false,
): Finding => ({
  rule,
  file,
  line,
  text,
  ...(hint ? { hint } : {}),
  ...(global ? { global: true } : {}),
})

/** S01 角色表互斥完备：每个文件必须恰好命中一个角色 */
export const roleTableComplete: Rule = {
  id: 'S01',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '目录契约（角色表互斥且完备）',
  hint: '按 PARADIGM.md 的目录契约把文件放到对应槽位',
  run: (ctx) => {
    const out: Finding[] = []
    for (const rel of ctx.scan.missing) {
      out.push(finding('S01', rel, 1, '文件不在目录契约内（未命中任何角色）', undefined, true))
    }
    for (const entry of ctx.scan.ambiguous) {
      out.push(
        finding(
          'S01',
          entry.rel,
          1,
          `角色歧义：同时命中 ${entry.roles.join(' / ')}`,
          '角色判据必须互斥，请调整路径',
          true,
        ),
      )
    }
    return out
  },
}

/** S02 目录深度 ≤3（相对源码根）：域内槽位下不许再嵌套 */
export const maxDepth: Rule = {
  id: 'S02',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '目录深度上限',
  hint: '域内固定七个槽位，槽位下不许再建目录；域变大了就拆成更多域',
  run: (ctx) => {
    const prefix = `${ctx.config.srcRoot}/`
    const max = 3
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (!record.rel.startsWith(prefix)) continue
      const rest = record.rel.slice(prefix.length)
      const depth = rest.split('/').length - 1
      if (depth > max) {
        out.push(finding('S02', record.rel, 1, `目录深度 ${depth} 超过上限 ${max}`))
      }
    }
    return out
  },
}

/** S10 禁相对越级：跨目录一律走别名 */
export const noParentImport: Rule = {
  id: 'S10',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '禁相对越级导入',
  hint: '跨目录用别名（如 @/shared/...），同目录用 ./',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      return facts.imports
        .filter((entry) => entry.spec.startsWith('../'))
        .map((entry) => finding('S10', record.rel, entry.line, `相对越级导入：${entry.spec}`))
    }),
}

/** S11 禁 barrel：`export *` 会把真实依赖藏起来，使依赖图不可判定 */
export const noBarrel: Rule = {
  id: 'S11',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '禁 barrel 再导出',
  hint: '直接导出具体符号，别用 export * 聚合',
  run: (ctx) =>
    ctx.records.flatMap((record) => {
      const facts = ctx.facts.get(record.rel)
      if (!facts) return []
      return facts.exports
        .filter((entry) => entry.isStar && !entry.typeOnly)
        .map((entry) => finding('S11', record.rel, entry.line, '禁 barrel：export * from ...'))
    }),
}

/** S12 命名契约 */
export const namingRules: Rule = {
  id: 'S12',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '命名契约',
  hint: '见 PARADIGM.md 的命名契约表',
  run: (ctx) => {
    const out: Finding[] = []
    const { hookPrefix, viewSuffix } = ctx.config.naming
    for (const record of ctx.records) {
      const base = record.rel.split('/').pop() ?? ''
      const stem = base.replace(/\.[^.]+$/, '')
      if (record.slot === 'hooks' && !stem.startsWith(hookPrefix)) {
        out.push(finding('S12', record.rel, 1, `hook 文件必须以 ${hookPrefix} 开头：${base}`))
      }
      // 只对代码文件查页面命名：views/ 下的 .module.css 是页面样式，不是页面
      if (record.slot === 'views' && /\.tsx?$/.test(base) && !stem.endsWith(viewSuffix)) {
        out.push(finding('S12', record.rel, 1, `页面文件必须以 ${viewSuffix} 结尾：${base}`))
      }
      // api 层允许 camelCase（queryKeys / queryClient 这类基础设施），只禁首字母大写与下划线
      if (record.role === 'shared:api' && (/^[A-Z]/.test(stem) || stem.includes('_'))) {
        out.push(finding('S12', record.rel, 1, `api 文件名必须小写 camelCase（禁首字母大写与下划线）：${base}`))
      }
      if (
        (record.role === 'shared:components:ui' || record.role === 'shared:components:common') &&
        base.endsWith('.tsx') &&
        !/^[A-Z]/.test(stem)
      ) {
        out.push(finding('S12', record.rel, 1, `组件文件必须 PascalCase：${base}`))
      }
    }
    return out
  },
}

/** S13 导出形态契约 */
export const exportShape: Rule = {
  id: 'S13',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '导出形态契约',
  hint: 'views 必须 default 导出；hooks 只导出 use*；model 只放类型与字面量常量',
  run: (ctx) => {
    const out: Finding[] = []
    for (const record of ctx.records) {
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      const exports = facts.exports.filter(
        (entry) => entry.declared || entry.isStar || entry.kind === 're-export',
      )
      if (record.slot === 'views' && facts.hasJsx) {
        if (!exports.some((entry) => entry.isDefault)) {
          out.push(finding('S13', record.rel, 1, '页面组件必须 default 导出（路由懒加载依赖它）'))
        }
      }
      if (record.slot === 'hooks') {
        for (const entry of exports) {
          // 类型导出是 hook 的公开契约（ToolStep / ConversationStream…），不是"非 hook 导出"
          if (entry.typeOnly) continue
          if (entry.isDefault || !entry.name.startsWith(ctx.config.naming.hookPrefix)) {
            out.push(
              finding('S13', record.rel, entry.line, `hook 模块只允许导出 use*：${entry.name}`),
            )
          }
        }
      }
      if (record.slot === 'model') {
        for (const entry of exports) {
          if (!['type', 'interface', 'const', 'enum', 're-export'].includes(entry.kind)) {
            out.push(
              finding(
                'S13',
                record.rel,
                entry.line,
                `model 只允许类型与字面量常量：${entry.name}（${entry.kind}）`,
              ),
            )
          }
        }
      }
      if (record.slot === 'lib') {
        for (const entry of exports) {
          if (entry.isDefault)
            out.push(finding('S13', record.rel, entry.line, 'lib 禁止 default 导出'))
        }
        if (facts.hasJsx) out.push(finding('S13', record.rel, 1, 'lib 是纯函数层，不得包含 JSX'))
      }
    }
    return out
  },
}

/** S14 有 views 的域必须有 routes.tsx（否则页面访问不到） */
export const routesRequired: Rule = {
  id: 'S14',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '域路由分片必填',
  hint: '有页面就在域根建 routes.tsx 并导出 *Routes，由 app/router 聚合',
  run: (ctx) => {
    const domains = new Map<string, { hasViews: boolean; hasRoutes: boolean; sample: string }>()
    for (const record of ctx.records) {
      if (!record.domain) continue
      const entry = domains.get(record.domain) ?? {
        hasViews: false,
        hasRoutes: false,
        sample: record.rel,
      }
      if (record.slot === 'views') {
        entry.hasViews = true
        // 定位点优先用代码文件：域级发现落在 .module.css 上会让人找不到北
        if (/\.tsx?$/.test(record.rel)) entry.sample = record.rel
      }
      if (record.slot === 'routes') entry.hasRoutes = true
      domains.set(record.domain, entry)
    }
    const out: Finding[] = []
    for (const [domain, entry] of domains) {
      if (entry.hasViews && !entry.hasRoutes) {
        out.push(
          finding(
            'S14',
            entry.sample,
            1,
            `域 ${domain} 有 views/ 但没有 routes.tsx`,
            '补 modules/' + domain + '/routes.tsx',
            true,
          ),
        )
      }
    }
    return out
  },
}

/** S16 体积阈值：文件与组件函数 */
export const sizeLimits: Rule = {
  id: 'S16',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '体积阈值',
  hint: '超过上限就拆：页面拆组件，组件拆函数',
  run: (ctx) => {
    const { fileLines, viewLines, functionLines } = ctx.config.thresholds
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.kind !== 'ts') continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      const limit = record.slot === 'views' ? viewLines : fileLines
      if (facts.lineCount > limit) {
        out.push({
          rule: 'S16',
          file: record.rel,
          line: 1,
          text: `文件 ${facts.lineCount} 行，超过上限 ${limit}`,
          hint: '拆成更小的单元',
          anchorKind: 'file',
        })
      }
      for (const fn of facts.functions) {
        if (fn.isComponent && fn.lines > functionLines) {
          out.push(
            finding(
              'S16',
              record.rel,
              fn.line,
              `组件函数 ${fn.name} 有 ${fn.lines} 行，超过上限 ${functionLines}`,
            ),
          )
        }
      }
    }
    return out
  },
}

export const structureRules: Rule[] = [
  parseFailClosed,
  roleTableComplete,
  maxDepth,
  noParentImport,
  noBarrel,
  namingRules,
  exportShape,
  routesRequired,
  sizeLimits,
]
