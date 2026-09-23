import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command, CommanderError } from 'commander'

import { err, out } from './engine/output.js'
import { checkPortability } from './engine/portability.js'
import { runGuard } from './engine/run.js'
import { runSelfTest } from './engine/self-test.js'
import type { Domain, Level, Severity } from './engine/types.js'
import { color } from './engine/util.js'
import { reactRules } from './packs/react/index.js'

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4']
const DOMAINS: Record<string, Domain> = {
  S: 'structure',
  D: 'design',
  C: 'copy',
  P: 'deps',
  H: 'hygiene',
  structure: 'structure',
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
  updateBaseline?: boolean
  reportOnly?: boolean
  localOnly?: boolean
  selfTest?: boolean
  selfCheckPortability?: boolean
}

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** 输出全部经 output.ts 唯一出口（cli 自身不直接写 stdout） */
export function createProgram(): Command {
  const program = new Command()
  program
    .name('arch-guard')
    .description('架构门禁：把架构写成可判定不变量的编码检查')
    .version(packageVersion(), '-v, --version')
    .option('--config <path>', '配置文件路径', 'arch.config.mjs')
    .option('--scope <mode>', '检测范围：full | changed | staged | since:<ref>', 'full')
    .option('--paths <globs>', '只报告匹配路径（逗号分隔）')
    .option('--domain <letters>', '只跑指定域：S,D,C,P,H（结构/设计/文案/依赖/退化）')
    .option('--only <ids>', '只跑指定规则（逗号分隔）')
    .option('--min-level <level>', '只跑判定等级不低于下限的规则：L1 | L2 | L3')
    .option('--severity <severity>', '只报告指定严重度：error | warn')
    .option('--format <format>', '输出格式：pretty | json', 'pretty')
    .option('--update-baseline', '把当前全部违规写入基线（只能在全量 scope 下）')
    .option('--report-only', '只报告，不因 error 退出非零')
    .option('--local-only', 'scope 非全量时允许跳过不可归属的全局违规')
    .option('--self-test', '跑夹具回归（每条规则违规必报 × 合规不报）')
    .option(
      '--self-check-portability',
      '检查本体自包含（P1 依赖 / P2 宿主字面量 / P3 引擎无布局假设）',
    )
    .addHelpText(
      'after',
      `
示例：
  $ arch-guard                              # 全项目检查
  $ arch-guard --scope=changed              # 只报告 git 变更文件（含未跟踪）
  $ arch-guard --domain=D --format=json     # 只看设计系统，输出 JSON
  $ arch-guard --update-baseline            # 把存量违规写进棘轮基线
`,
    )
  return program
}

export async function run(argv: string[]): Promise<number> {
  const packageRoot = fileURLToPath(new URL('..', import.meta.url))
  const program = createProgram()
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

  if (options.selfTest) {
    const result = await runSelfTest(packageRoot, reactRules)
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
        `✔ 本体自包含通过（P1 依赖 / P2 宿主字面量 / P3 引擎无布局假设），检查了 ${result.checked} 个文件`,
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
        err(color.red(`✖ 未知域：${token}（可用 S/D/C/P/H）`))
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
  if (options.format !== 'pretty' && options.format !== 'json') {
    err(color.red(`✖ 未知输出格式：${options.format}（可用 pretty/json）`))
    return 2
  }

  try {
    const result = await runGuard({
      cwd: process.cwd(),
      rules: reactRules,
      format: options.format as 'pretty' | 'json',
      scope: options.scope,
      reportOnly: options.reportOnly === true,
      localOnly: options.localOnly === true,
      updateBaseline: options.updateBaseline === true,
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

// 直接调用（node es/cli.js）时自执行；被 bin/arch-guard.mjs import 时不重复执行。
// 不用顶层 await —— 顶层 await 会让 CJS 产物无法生成（esbuild 限制）。
const invokedAsScript =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) {
  void run(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}
