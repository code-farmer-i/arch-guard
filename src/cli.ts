import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command, CommanderError } from 'commander'

import { loadConfig } from './engine/config.js'
import { collectDocDiffs } from './engine/docs.js'
import { explainPaths, renderExplanations } from './engine/explain.js'
import { rootRelativePattern } from './engine/git.js'
import { err, out } from './engine/output.js'
import { createRegistry } from './engine/registry.js'
import { writeInitConfig } from './presets/init.js'
import { checkPortability } from './engine/portability.js'
import { runGuard } from './engine/run.js'
import { runSelfTest } from './engine/self-test.js'
import type { Domain, Level, Severity } from './engine/types.js'
import { color } from './engine/util.js'
import { coreRules } from './packs/core/index.js'
import { placementHint } from './packs/core/rules/placement.js'
import { reactPack } from './packs/react/index.js'

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4']
const DOMAINS: Record<string, Domain> = {
  S: 'structure',
  M: 'metrics',
  D: 'design',
  C: 'copy',
  P: 'deps',
  H: 'hygiene',
  structure: 'structure',
  metrics: 'metrics',
  design: 'design',
  copy: 'copy',
  deps: 'deps',
  hygiene: 'hygiene',
}

interface CliOptions {
  config?: string
  scope: string
  paths?: string
  domain?: string
  only?: string
  minLevel?: string
  severity?: string
  format: string
  stats?: boolean
  cache?: boolean
  verifyDeps?: boolean
  explain?: string
  renderDocs?: boolean
  checkDocs?: boolean
  coverageReport?: string
  updateCoverage?: boolean
  reportOnly?: boolean
  localOnly?: boolean
  selfTest?: boolean
  selfCheckPortability?: boolean
}

function packageVersion(root = fileURLToPath(new URL('..', import.meta.url))): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** 输出全部经 output.ts 唯一出口（cli 自身不直接写 stdout） */
export function createProgram(version: string = packageVersion()): Command {
  const program = new Command()
  program
    .name('arch-guard')
    .description('架构门禁：把架构写成可判定不变量的编码检查')
    .version(version, '-v, --version')
    .option('--config <path>', '配置文件路径', 'arch.config.mjs')
    .option('--scope <mode>', '检测范围：full | changed | staged | since:<ref>', 'full')
    .option('--paths <globs>', '只报告匹配路径（逗号分隔）')
    .option('--domain <letters>', '只跑指定域：S,D,C,P,H,M（结构/设计/文案/依赖/退化/度量）')
    .option('--only <ids>', '只跑指定规则（逗号分隔）')
    .option('--min-level <level>', '只跑判定等级不低于下限的规则：L1 | L2 | L3')
    .option('--severity <severity>', '只报告指定严重度：error | warn')
    .option('--format <format>', '输出格式：pretty | json | github（CI 注解）', 'pretty')
    .option('--stats', '打印每条规则的耗时与命中数（排查「为什么这么慢」）')
    .option('--no-cache', '不做 facts 持久缓存（每轮全量解析；排查缓存相关问题时用）')
    .option('--verify-deps', '只对账：适配表声明的包 vs package.json 实际依赖（不跑规则）')
    .option(
      '--render-docs',
      '把文档里的管理块（<!-- arch-guard:begin X --> …）按 arch.config.mjs 重写',
    )
    .option('--check-docs', '只校验文档管理块与 arch.config.mjs 是否一致（漂移即失败）')
    .option(
      '--explain <paths>',
      '讲清一批路径的契约（角色 / 能依赖谁 / 该放哪 / 适用规则），写代码之前用；逗号分隔，可绝对路径',
    )
    .option('--coverage-report <path>', '覆盖率产物路径（覆盖 metrics 适配器里的配置）')
    .option(
      '--update-coverage',
      '刷新覆盖率棘轮快照（M04 用）；与「豁免违规」无关 —— 违规没有豁免渠道',
    )
    .option('--report-only', '只报告，不因 error 退出非零')
    .option('--local-only', 'scope 非全量时允许跳过不可归属的全局违规')
    .option('--self-test', '跑夹具回归（每条规则违规必报 × 合规不报）')
    .option(
      '--self-check-portability',
      '检查本体自包含（P1 依赖 / P2 宿主字面量 / P3 引擎无布局假设 / P4 库名只在数据表与适配器面）',
    )
  program
    .command('init')
    .description('生成一份填好落点的 arch.config.mjs（用户只回答"选什么"，不用想"怎么配"）')
    .option('--paradigm <name>', '范式：canonical | fsd | library', 'canonical')
    .option('--ui <kit>', '组件库适配器：antd | none', 'none')
    .option('--data <kit>', '数据层适配器：react-query | none', 'none')
    .option('--i18n <kit>', 'i18n 适配器：i18next | none', 'none')
    .option('--langs <list>', '要支持的语言（逗号分隔）', 'zh-CN,en')
    .option('--out <path>', '输出文件', 'arch.config.mjs')
    .option('--force', '文件已存在时覆盖')
  // 父命令必须有个 action：否则 commander 一看到有子命令就以为「没给命令」，直接打帮助，
  // 后面那条分发分支就再也跑不到（--verify-deps 等选项全被吞掉）。
  program.action(() => undefined)
  program.addHelpText(
    'after',
    `
示例：
  $ arch-guard                              # 全项目检查
  $ arch-guard init --ui antd --data react-query --i18n i18next   # 起一份配置
  $ arch-guard --scope=changed              # 只报告 git 变更文件（含未跟踪）
  $ arch-guard --domain=D --format=json     # 只看设计系统，输出 JSON
  $ arch-guard --update-coverage            # 刷新覆盖率棘轮快照（不是豁免违规）
`,
  )
  return program
}

/**
 * CLI 主流程（可注入 `packageRoot`：自检与本体自包含检查要能对**临时副本**跑，
 * 这样失败分支也能在同进程里被测到，而不是只能 spawn 子进程 —— 子进程的执行不会被
 * 父进程的覆盖率统计合并）。
 */
export async function run(argv: string[], hooks: { packageRoot?: string } = {}): Promise<number> {
  const packageRoot = hooks.packageRoot ?? fileURLToPath(new URL('..', import.meta.url))
  const program = createProgram(packageVersion(packageRoot))
  program.exitOverride()
  program.configureOutput({
    writeOut: (text) => out(text.replace(/\n$/, '')),
    writeErr: (text) => err(text.replace(/\n$/, '')),
  })

  try {
    program.parse(argv, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2
    err(color.red(`✖ ${(error as Error).message}`))
    return 2
  }

  const options = program.opts<CliOptions>()

  // `arch-guard init`：生成起点配置（R-106）。子命令的参数在它自己的 Command 上。
  if (argv[0] === 'init') {
    const command = program.commands.find((item) => item.name() === 'init')
    const { path, written } = writeInitConfig(
      (command?.opts() ?? {}) as Parameters<typeof writeInitConfig>[0],
      process.cwd(),
    )
    if (!written) {
      err(color.yellow(`⚠ ${path} 已存在（要覆盖加 --force）`))
      return 2
    }
    out(color.green(`✔ 已生成 ${path}`))
    out(
      color.dim(
        '下一步：pnpm exec arch-guard  →  看报告的停用清单，它会给出"想要跑就写这一行"的片段（docs/USAGE.md §2）',
      ),
    )
    return 0
  }

  if (options.selfTest) {
    const result = await runSelfTest(packageRoot, coreRules)
    if (result.failures.length > 0) {
      out(color.red(`✖ 夹具回归失败：${result.failures.length}/${result.total}`))
      for (const failure of result.failures) out(`  ${failure.fixture}: ${failure.message}`)
      return 1
    }
    out(color.green(`✔ 夹具回归通过：${result.passed}/${result.total}`))
    return 0
  }

  if (options.selfCheckPortability) {
    const result = checkPortability(packageRoot)
    if (result.findings.length > 0) {
      out(
        color.red(
          `✖ 本体自包含检查失败：${result.findings.length} 处（检查了 ${result.checked} 个文件）`,
        ),
      )
      for (const item of result.findings)
        out(`  ${item.file}:${item.line} [${item.rule}] ${item.text}`)
      return 1
    }
    out(
      color.green(
        `✔ 本体自包含通过（P1 依赖 / P2 宿主字面量 / P3 引擎无布局假设 / P4 库名只在数据表与适配器面），检查了 ${result.checked} 个文件`,
      ),
    )
    return 0
  }

  /* 选项校验：非法取值必须明确报错（fail closed） */
  const domains: Domain[] = []
  if (options.domain) {
    for (const token of options.domain.split(',').filter(Boolean)) {
      const domain = DOMAINS[token]
      if (!domain) {
        err(color.red(`✖ 未知域：${token}（可用 S/D/C/P/H/M）`))
        return 2
      }
      domains.push(domain)
    }
  }
  if (options.minLevel && !LEVELS.includes(options.minLevel as Level)) {
    err(color.red(`✖ 未知判定等级：${options.minLevel}（可用 L1/L2/L3/L4）`))
    return 2
  }
  if (options.severity && options.severity !== 'error' && options.severity !== 'warn') {
    err(color.red(`✖ 未知严重度：${options.severity}（可用 error/warn）`))
    return 2
  }
  if (options.format !== 'pretty' && options.format !== 'json' && options.format !== 'github') {
    err(color.red(`✖ 未知输出格式：${options.format}（可用 pretty/json/github）`))
    return 2
  }

  if (options.verifyDeps === true) {
    return verifyDeps(options.config)
  }

  if (options.explain) {
    return explain(options.explain, options.config, options.format)
  }

  if (options.renderDocs === true || options.checkDocs === true) {
    return syncDocs(options.config, options.checkDocs === true)
  }

  try {
    const result = await runGuard({
      cwd: process.cwd(),
      /**
       * 规则集由框架包决定（配置里可写 `packs: [...]`）；CLI 只提供**兜底的包**。
       *
       * 兜底为什么仍是 `reactPack`（而不是更"通用"的 `tsPack`）：
       * 两者的规则集今天完全相同，差别只在声明支持的适配面 —— 而 `reactPack` 是唯一能配
       * `uiKit(...)` 的历史入口。**忘了写 `packs` 的 React 宿主靠它继续可用**，不静默变红。
       * 泛 TS 宿主（库 / CLI）请在 `arch.config.mjs` 里显式写 `packs: [tsPack]`。
       */
      fallbackPacks: [reactPack],
      cache: options.cache !== false,
      format: options.format as 'pretty' | 'json' | 'github',
      stats: options.stats === true,
      ...(options.coverageReport ? { coverageReport: options.coverageReport } : {}),
      scope: options.scope,
      reportOnly: options.reportOnly === true,
      localOnly: options.localOnly === true,
      updateCoverage: options.updateCoverage === true,
      configPath: options.config,
      ...(options.paths ? { paths: options.paths.split(',').filter(Boolean) } : {}),
      ...(domains.length > 0 ? { domain: domains } : {}),
      ...(options.only ? { only: options.only.split(',').filter(Boolean) } : {}),
      ...(options.minLevel ? { minLevel: options.minLevel as Level } : {}),
      ...(options.severity ? { severity: options.severity as Severity } : {}),
    })
    return result.exitCode
  } catch (error) {
    // fail closed：引擎异常永远非零
    err(color.red(`✖ 引擎异常：${(error as Error).message}`))
    return 2
  }
}

/**
 * `--render-docs` / `--check-docs`：文档管理块与 `arch.config.mjs` 对账。
 *
 * 文档里那些表是**手抄**的，而 agent 读到的"规范"必须与门禁判的是同一份 ——
 * 渲染结果与文件不符即红（DESIGN §7.3）。`--render-docs` 负责重写，`--check-docs` 只校验。
 */
async function syncDocs(configPath: string | undefined, checkOnly: boolean): Promise<number> {
  try {
    const cwd = process.cwd()
    const loaded = await loadConfig({
      root: cwd,
      ...(configPath ? { configPath } : {}),
      fallbackPacks: [reactPack],
    })
    const { diffs, errors, filesWithBlocks } = collectDocDiffs(cwd, loaded.config)
    if (errors.length > 0) {
      for (const error of errors) err(color.red(`✖ ${error}`))
      return 2
    }
    if (filesWithBlocks === 0) {
      out(
        color.dim(
          '（没有任何文档管理块：在文档里加 <!-- arch-guard:begin deps --> … <!-- arch-guard:end deps --> 就能从 config 渲染）',
        ),
      )
      return 0
    }
    if (diffs.length === 0) {
      out(color.green(`✔ 文档管理块与 arch.config.mjs 一致（${filesWithBlocks} 个文件）`))
      return 0
    }
    if (checkOnly) {
      for (const diff of diffs) {
        err(color.red(`✖ ${diff.file}：块 ${diff.changed.join(' / ')} 与 arch.config.mjs 不一致`))
      }
      out(color.red(`✖ 文档漂移：${diffs.length} 个文件 —— 跑 \`arch-guard --render-docs\` 同步`))
      return 1
    }
    for (const diff of diffs) {
      writeFileSync(join(cwd, diff.file), diff.rendered, 'utf8')
      out(color.green(`✔ 已更新 ${diff.file}：${diff.changed.join(' / ')}`))
    }
    return 0
  } catch (error) {
    err(color.red(`✖ 引擎异常：${(error as Error).message}`))
    return 2
  }
}

/**
 * `--explain <路径>`：**写之前**把契约讲清楚。
 *
 * 与判定路径的分工：判定说"你错了"，解释说"该怎么做"。它一条规则都不跑，
 * 数据全部来自角色表 + 布局 + 结构声明 + `params` —— 所以零误报，也永远不需要维护第二份规范。
 * 退出码恒为 0（这是查询，不是判决）。
 */
async function explain(
  pathsInput: string,
  configPath: string | undefined,
  format: string,
): Promise<number> {
  try {
    const cwd = process.cwd()
    const loaded = await loadConfig({
      root: cwd,
      ...(configPath ? { configPath } : {}),
      fallbackPacks: [reactPack],
    })
    const registry = createRegistry(coreRules, loaded.config)
    const paths = pathsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      // 绝对路径要归一成配置根相对（IDE / agent 按文件传参时给的就是绝对路径）
      .map((item) => rootRelativePattern(item, cwd))
    const list = explainPaths({
      config: loaded.config,
      paths,
      enabled: registry.enabled,
      skipped: registry.skipped,
      placement: placementHint,
    })
    out(renderExplanations(list, format === 'json' ? 'json' : 'pretty'))
    return 0
  } catch (error) {
    err(color.red(`✖ 引擎异常：${(error as Error).message}`))
    return 2
  }
}

/**
 * `--verify-deps`：把适配表与实际依赖对账并打印全表。
 * 与 P04 的分工：P04 是红线（错就拒），这条是排查工具（告诉你全貌）。
 */
async function verifyDeps(configPath: string | undefined): Promise<number> {
  try {
    const { loadConfig } = await import('./engine/config.js')
    const { readProjectDeps } = await import('./engine/deps.js')
    const { auditAdapterDeps, describePolicy } = await import('./engine/deps-audit.js')
    const { depsPolicyFrom } = await import('./engine/deps.js')
    const loaded = await loadConfig({ root: process.cwd(), ...(configPath ? { configPath } : {}) })
    const deps = readProjectDeps(loaded.config.root, [])
    const audit = auditAdapterDeps(loaded.config, deps)
    out(color.bold('适配表 vs 实际依赖'))
    if (audit.rows.length === 0) out('  （没有声明任何适配器）')
    for (const row of audit.rows) {
      const spec = row.specVersion ? color.dim(` spec ${row.specVersion}`) : ''
      out(`  ${row.facet.padEnd(10)} ${row.id}${spec}`)
      // 形态 / 落点等字段：没有包可对账的 kit（CSS Module 这类）靠它才看得见
      for (const field of row.fields) out(`    ${color.dim(field.name)}: ${field.value}`)
      for (const item of row.packages) {
        out(`    ${item.declared ? color.green('✔') : color.red('✖')} ${item.name}`)
      }
      if (row.packages.length === 0) out(color.dim('    （这套方案没有 npm 包）'))
    }
    out(`  依赖策略：${describePolicy(depsPolicyFrom(loaded.config.params))}`)
    if (audit.foreign.length > 0) {
      out(color.red(`  装有适配表之外的组件库：${audit.foreign.join(', ')}`))
    }
    out(audit.ok ? color.green('✔ 对账通过') : color.red('✖ 对账失败：适配表与依赖不一致'))
    return audit.ok ? 0 : 1
  } catch (error) {
    err(color.red(`✖ 引擎异常：${(error as Error).message}`))
    return 2
  }
}

// 直接调用（node es/cli.js）时自执行；被 bin/arch-guard.mjs import 时不重复执行。
// 不用顶层 await —— 顶层 await 会让 CJS 产物无法生成（esbuild 限制）。
/**
 * 判断是不是「直接跑这个文件」。必须 realpath 后比较：
 * macOS 的 `/tmp`→`/private/tmp`（以及任何软链路径）会让 argv[1] 与 import.meta.url
 * 字面上不同，那样 CLI 会**静默什么都不做且退出 0** —— 比报错更糟。
 */
function invokedAsScript(): boolean {
  const entry = process.argv[1]
  if (entry === undefined) return false
  const real = (path: string): string => {
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }
  return real(resolve(entry)) === real(fileURLToPath(import.meta.url))
}
if (invokedAsScript()) {
  void run(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}
