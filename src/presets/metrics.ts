import { defineAdapter } from '../engine/adapters.js'
import type { Preset } from '../engine/types.js'

/** 目录级覆盖率下限：数字＝只判行覆盖，对象＝分指标判 */
export type PerDirMin = Record<
  string,
  number | { lines?: number; branches?: number; functions?: number }
>

export interface CoverageOptions {
  /** 覆盖率产物路径（istanbul/c8/vitest 的 coverage-summary.json，或 Node 覆盖率表格文本） */
  report: string
  /** 目录级下限：`{ 'src/engine/**': 90 }` —— 这一条替代了「总覆盖率阈值」 */
  perDirMin?: PerDirMin
  /** 允许覆盖率为 0 的文件；**必须写理由** */
  zeroAllow?: { file: string; reason: string }[]
  /** 覆盖率棘轮：与基线比不得倒退 */
  ratchet?: boolean
  /** 棘轮快照（--update-baseline 会一并写入） */
  baselineFile?: string
  /** 本次改动的文件必须被覆盖（默认只要求源文件） */
  mustCover?: string[]
  /** 报告里的路径 → 项目路径（例如构建产物 `es/x.js` 对应源码 `src/x.ts`） */
  pathRewrite?: [string, string][]
}

/** 测试治理：哪些文件必须有测试、门禁链路必须包含什么 */
export interface TestGateOptions {
  requireTestsFor?: string[]
  testGlobs?: string[]
  checkChain?: { script?: string; require?: string[] }
}

export interface MetricsOptions {
  coverage?: CoverageOptions
  tests?: TestGateOptions
  /** 依赖预算：运行时/开发依赖数量上限（超过要解释，防依赖膨胀） */
  depsBudget?: { runtime?: number; dev?: number }
}

/**
 * 度量预设（M 域）：只读**别人跑完写下的数字产物** + 阈值，门禁自己不跑测试、不构建。
 *
 * 与生态的分工：总覆盖率阈值 vitest/c8 自带，所以这里**不做**（用 `perDirMin: { 'src/**': 95 }`
 * 表达总阈值即可）；我们做它们没有的：目录级下限、零覆盖文件、棘轮、变更文件必须被覆盖、
 * 产物缺失/过期 fail-closed、依赖预算。
 */
export function metrics(options: MetricsOptions = {}): Preset {
  // 度量数据走**适配器**（与 copy() 同一套机制）：没声明时 M 域规则以「能力未声明」进 skipped，
  // 而不是静默失能。
  const adapter = defineAdapter('metrics', {
    id: 'coverage',
    specVersion: '1',
    ...(options.coverage ? { coverage: options.coverage } : {}),
    ...(options.tests
      ? {
          ...(options.tests.requireTestsFor
            ? {
                tests: {
                  requireTestsFor: options.tests.requireTestsFor,
                  ...(options.tests.testGlobs ? { testGlobs: options.tests.testGlobs } : {}),
                },
              }
            : {}),
          ...(options.tests.checkChain ? { checkChain: options.tests.checkChain } : {}),
        }
      : {}),
    ...(options.depsBudget ? { depsBudget: options.depsBudget } : {}),
  })
  return {
    enable: ['M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09'],
    adapters: { metrics: adapter },
  }
}
