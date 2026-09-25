import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'
import { ENV_READ_ROOTS } from '../data/env-roots.js'

/**
 * **环境读取落点**预设：`import.meta.env.X` / `process.env.X` 只许出现在声明的配置模块里（S44）。
 *
 * 场景：环境变量在十几个文件里直接读 —— 改名 / 换环境全仓搜，而且读到的还是原始字符串
 * （没有默认值、没有校验、没有类型）。收进配置模块，别处只消费。
 */
defineFacet('env-reads', {
  fields: ['apis', 'apisFrom', 'in', 'examples'],
  capabilityRoot: 'envReads',
})

export interface EnvReadsOptions {
  /**
   * 哪些读取算"环境读取"：**可以不写** —— 缺省取平台表 `data/env-roots.ts` 的读取根
   * （`import.meta.env` / `process.env`）。写错一个字母就会 0 命中，所以真给了就校验。
   */
  apis?: string[]
  /** 只许出现在哪些落点（glob 列表）：`['src/shared/config/**']` */
  in: string[]
}

export function envReads(options: EnvReadsOptions): Preset {
  // 缺省来自**平台表**（平台的事实，不必每个宿主抄一遍）；显式给空数组 = 关掉这条门禁，仍然报错
  const apis = options.apis ?? ENV_READ_ROOTS
  const allowed = options.in ?? []
  if (apis.length === 0 || allowed.length === 0) {
    throw new AdapterError(
      'envReads() 的 in 不能为空：它声明"只许出现在哪些落点"\n' +
        '（缺了这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  return {
    enable: ['S44'],
    adapters: {
      'env-reads': defineAdapter<GenericAdapter>('env-reads', {
        id: 'declared',
        specVersion: '1',
        apis: [...apis],
        // 宿主没给 apis = 用的是平台表默认 → 自述（R-86）不把它当"项目声明"来点名
        ...(options.apis === undefined ? { apisFrom: 'platform' } : {}),
        in: [...allowed],
      }),
    },
  }
}
