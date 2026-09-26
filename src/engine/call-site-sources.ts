import { CALL_SITE_FACET_SOURCES, CALL_SITE_SOURCES } from '../data/call-site-sources.js'
import type { Config } from './types.js'

/** `callSites` 组：要么直接给 `apis`，要么用 `from` 指向一处既有清单（数据表 / 面适配器字段） */
export interface CallSiteGroupLike {
  name?: string
  apis?: string[]
  from?: string
  in?: string[]
  /** 收窄到第一个字符串字面量实参（R-110）：自述里也要检查它有没有命中（R-114） */
  args?: string[]
}

/**
 * 解析一组的 API 名单：**项目显式给的优先**，否则按 `from` 取（平台表 → 面适配器字段）。
 * 解析不出来（来源没声明 / 名单为空）就返回空数组 —— 调用方（规则 / 自述）各自决定怎么处理。
 */
export function resolveCallSiteApis(config: Config, group: CallSiteGroupLike): string[] {
  if (group.apis && group.apis.length > 0) return group.apis
  const from = group.from
  if (!from) return []
  const table = CALL_SITE_SOURCES[from]
  if (table) return table
  const facet = CALL_SITE_FACET_SOURCES[from]
  if (!facet) return []
  const adapter = config.adapters[facet.facet] as Record<string, unknown> | undefined
  const value = adapter?.[facet.field]
  return Array.isArray(value) ? (value as string[]) : []
}
