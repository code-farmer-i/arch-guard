import { resolveFramework } from '../../../data/framework-sources.js'
import type { Finding, Rule } from '../../../engine/types.js'

import { placementHint } from './placement.js'

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

/**
 * S03 文件必须落在某个槽位：域根目录只许 `routes.tsx`（`*.d.ts` 例外）。
 *
 * 与 S01 的分工：S01 管「src 下的目录白名单 + 角色表互斥完备」，S03 把「域根不放散件」
 * 这一条单独拎出来给更明确的提示，所以 S01 会跳过域根文件，避免同一处报两遍。
 */
export const domainRootOnlyRoutes: Rule = {
  id: 'S03',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '域根目录只许 routes.tsx',
  hint: '域根只放 routes.tsx；页面进 views/、域内类型与常量进 model/、纯函数进 lib/、域内组件进 components/',
  run: (ctx) => {
    // 域根从 layout 读（唯一真相），不要再拼 `${srcRoot}/modules` —— 见 structure-graph 的 rootsOf
    const modulesRoot = ctx.config.layout.modules
    const out: Finding[] = []
    for (const rel of [...ctx.scan.missing, ...ctx.scan.ambiguous.map((entry) => entry.rel)]) {
      if (!rel.startsWith(`${modulesRoot}/`)) continue
      const rest = rel.slice(modulesRoot.length + 1)
      const segments = rest.split('/')
      // 域根下的文件：modules/<域>/<file>
      if (segments.length !== 2) continue
      if (segments[1] === 'routes.tsx' || rel.endsWith('.d.ts')) continue
      out.push(
        finding(
          'S03',
          rel,
          1,
          `域根目录只许 routes.tsx，出现了 ${segments[1]}`,
          placementHint(rel, ctx.config),
        ),
      )
    }
    return out
  },
}

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
    // 域根从 layout 读（唯一真相），不要再拼 `${srcRoot}/modules` —— 见 structure-graph 的 rootsOf
    const modulesRoot = ctx.config.layout.modules
    /** 域根下的散件由 S03 专门报，S01 跳过以免同一处报两遍 */
    const isDomainRootFile = (rel: string): boolean =>
      rel.startsWith(`${modulesRoot}/`) && rel.slice(modulesRoot.length + 1).split('/').length === 2
    for (const rel of ctx.scan.missing) {
      if (isDomainRootFile(rel)) continue
      out.push(
        finding(
          'S01',
          rel,
          1,
          '文件不在目录契约内（未命中任何角色）',
          placementHint(rel, ctx.config),
          true,
        ),
      )
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
    // 默认 4：范式里 shared/i18n/locales/<lang>/<ns>.ts 本身就是 4 层；
    // 上限防的是「随手往下挖目录」，不是精确等于 3。可用 params.maxDepth 覆盖。
    const max = Number(ctx.config.params.maxDepth ?? 4)
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
        out.push(
          finding(
            'S12',
            record.rel,
            1,
            `api 文件名必须小写 camelCase（禁首字母大写与下划线）：${base}`,
          ),
        )
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
        // 定位点优先用**第一个**代码文件：域级发现落在 .module.css 上会让人找不到北，
        // 但不能反复覆盖（否则定位点会随遍历顺序漂移，棘轮锚点也跟着漂）
        if (/\.tsx?$/.test(record.rel) && !/\.tsx?$/.test(entry.sample)) entry.sample = record.rel
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

/**
 * S19 导出宽度与单文件组件数：一个文件是一个单元。
 *
 * 为什么和 S16 分开：S16 量的是「行数」（任何工程类型都成立），S19 量的是「一个文件承担了几件事」——
 * 它对**应用**成立，对**库**不成立：库的入口（`src/index.ts`）就是公开面，导出几十个符号是正确形态。
 * 规则集必须跟着工程类型走（ADR-0003），所以 `canonical()` 默认开、`library()` 的启用名单里没有它。
 */
export const widthLimits: Rule = {
  id: 'S19',
  domain: 'structure',
  level: 'L2',
  severity: 'error',
  title: '导出宽度与单文件组件数',
  hint: '导出值太多说明这个文件承担了多件事；组件太多说明该拆成组件目录',
  run: (ctx) => {
    const { exportsPerFile, componentsPerFile } = ctx.config.thresholds
    const out: Finding[] = []
    for (const record of ctx.records) {
      if (record.kind !== 'ts') continue
      const facts = ctx.facts.get(record.rel)
      if (!facts) continue
      // 「导出值」不含类型：类型导出是契约，不是宽度
      const values = facts.exports.filter((entry) => !entry.typeOnly)
      if (values.length > exportsPerFile) {
        out.push(
          finding(
            'S19',
            record.rel,
            values[0]?.line ?? 1,
            `导出值 ${values.length} 个，超过上限 ${exportsPerFile}`,
            '按职责拆文件',
          ),
        )
      }
      const components = facts.functions.filter((fn) => fn.isComponent)
      if (components.length > componentsPerFile) {
        out.push(
          finding(
            'S19',
            record.rel,
            components[0]?.line ?? 1,
            `单文件组件 ${components.length} 个，超过上限 ${componentsPerFile}`,
            '拆成 components/ 目录',
          ),
        )
      }
    }
    return out
  },
}

/**
 * S20 框架包必须覆盖项目的源码形态：扫到当前 pack 量不了的源码文件就报错。
 *
 * 为什么是红线而不是提示：那些文件会被 walk 直接丢掉，于是「量不了」表现为
 * 「0 个文件 → ✔ 通过」—— 假绿比报错危险。要么换 pack，要么把 `metaFramework` 配对。
 */
export const frameworkCoverage: Rule = {
  id: 'S20',
  domain: 'structure',
  level: 'L1',
  severity: 'error',
  title: '框架包必须覆盖项目的源码形态',
  hint: '这些文件不在当前框架包的处理范围内，会被静默跳过；换对应 pack，或把这些源码移出扫描范围',
  run: (ctx) => {
    if (ctx.scan.foreign.length === 0) return []
    const kinds = new Map<string, number>()
    for (const rel of ctx.scan.foreign) {
      const ext = rel.slice(rel.lastIndexOf('.'))
      kinds.set(ext, (kinds.get(ext) ?? 0) + 1)
    }
    const detail = [...kinds.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ext, count]) => `${ext} × ${count}`)
      .join('、')
    return [
      finding(
        'S20',
        ctx.scan.foreign[0] as string,
        1,
        `发现 ${ctx.scan.foreign.length} 个当前框架包（${resolveFramework(ctx.config.metaFramework)}）量不了的源码文件：${detail}`,
        '本工具目前只有 react pack；要么换 pack，要么把这段源码移出扫描范围（ignore）',
        true,
      ),
    ]
  },
}

export const structureRules: Rule[] = [
  domainRootOnlyRoutes,
  parseFailClosed,
  roleTableComplete,
  maxDepth,
  noBarrel,
  namingRules,
  exportShape,
  routesRequired,
  sizeLimits,
  widthLimits,
  frameworkCoverage,
]
