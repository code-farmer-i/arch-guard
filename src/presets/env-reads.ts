import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'

/**
 * **环境读取落点**预设：`import.meta.env.X` / `process.env.X` 只许出现在声明的配置模块里（S44）。
 *
 * 场景：环境变量在十几个文件里直接读 —— 改名 / 换环境全仓搜，而且读到的还是原始字符串
 * （没有默认值、没有校验、没有类型）。收进配置模块，别处只消费。
 */
defineFacet('env-reads', {
  fields: ['apis', 'in', 'examples'],
  capabilityRoot: 'envReads',
})

export interface EnvReadsOptions {
  /** 哪些读取算"环境读取"：`['import.meta.env', 'process.env']` */
  apis: string[]
  /** 只许出现在哪些落点（glob 列表）：`['src/shared/config/**']` */
  in: string[]
}

export function envReads(options: EnvReadsOptions): Preset {
  const apis = options.apis ?? []
  const allowed = options.in ?? []
  if (apis.length === 0 || allowed.length === 0) {
    throw new AdapterError(
      'envReads() 需要同时给 apis 与 in：前者是"哪些读取算环境读取"，后者是"只许出现在哪些落点"\n' +
        '（缺一个这条门禁就静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  return {
    enable: ['S44'],
    adapters: {
      'env-reads': defineAdapter<GenericAdapter>('env-reads', {
        id: 'declared',
        specVersion: '1',
        apis: [...apis],
        in: [...allowed],
      }),
    },
  }
}
