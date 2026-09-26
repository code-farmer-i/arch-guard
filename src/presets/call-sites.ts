import { AdapterError, defineAdapter, defineFacet } from '../engine/adapters.js'
import type { GenericAdapter, Preset } from '../engine/types.js'
import { CALL_SITE_SOURCE_IDS } from '../data/call-site-sources.js'

/**
 * **调用落点**预设：某一类调用**只许出现在声明的封装里**。
 *
 * 一个面覆盖"同类问题"的几组落点（每组声明"哪些调用" + "只许出现在哪"）：
 *
 * - **副作用**：`gtag()` / `Sentry.captureException()` / `localStorage.getItem('token')` 散在各域 ——
 *   隐私判断没地方统一、token 要加密时全仓找、换 SDK 要翻遍页面。
 * - **配置对象实例化**：某个域自己 `new QueryClient()` / `createTheme()` / `createStore()` ——
 *   运行时出现两个缓存实例（`invalidateQueries` 莫名不生效）、主题不统一，查一下午。
 *
 * 为什么"一个面 + 多组"而不是每个场景一个面：面的形状完全一样（`name` / `apis` / `in`），
 * 拆成两个面就是"同一个事实的第二处"。**为什么是预设直接收数据而不是一套 kit**：
 * 这些 API 名全是项目决定的（用哪个埋点 SDK、存储封装叫什么），没有"某个库的方案"可以内置 ——
 * 同 `deps({ allow })` 的形态。
 */
defineFacet('call-sites', {
  fields: ['groups', 'examples'],
  capabilityRoot: 'callSites',
})

export interface CallSiteGroup {
  /** 组名（出现在报告里："在这里调用副作用 API（gtag）…"） */
  name: string
  /**
   * 哪些调用算这一类：`['localStorage','gtag','Sentry.captureException']`。
   * **可以不写** —— 用 `from` 指向一处既有清单（平台表 / 面适配器），省得把库/平台的事实抄一遍。
   */
  apis?: string[]
  /**
   * API 名单的来源：`'platform.storage'` / `'platform.timers'` / `'platform.network'`（平台表）
   * 或 `'analytics'` / `'data-layer.singletons'`（面适配器已声明的清单）。
   * 写错来源会在**配置期报错**并列出可用值（不然那一组会安静地什么都不判）。
   */
  from?: string
  /** 只许出现在哪些落点（glob 列表）：`['src/shared/lib/storage.ts','src/app/**']` */
  in: string[]
  /**
   * **收窄到"实参名"**（可选）：只有第一个字符串字面量实参命中这份名单才算这一类调用。
   *
   * 为什么需要它（R-110）：`searchParams.get` / `cookies.get` / `getItem` 这类 API 名字**太泛** ——
   * 声明 `apis: ['searchParams.get']` 会把 `?page=` / `?tab=` 全判红；不声明则租户 id 从哪来没人管。
   * 声明 `args: ['tenantId','tenant']` 之后：`get('tenantId')` 判、`get('page')` 不判。
   *
   * **边界**：只比**第一个字符串字面量实参** —— `const { tenantId } = useParams()`、`props.tenantId`、
   * header/cookie 形态都看不见、不报（宁少报不误伤）。
   */
  args?: string[]
}

export function callSites(groups: CallSiteGroup[]): Preset {
  const list = groups ?? []
  for (const group of list) {
    if (group.from && !CALL_SITE_SOURCE_IDS.includes(group.from)) {
      throw new AdapterError(
        `callSites()[${group.name ?? '?'}] 的来源 ${group.from} 不认识\n` +
          `（可用：${CALL_SITE_SOURCE_IDS.join(' / ')}）`,
      )
    }
  }
  if (list.length === 0) {
    throw new AdapterError(
      'callSites() 至少要给一组落点：`callSites([{ name: "副作用", apis: [...], in: [...] }])`\n' +
        '（空清单会让这条门禁静默停用 —— 与其这样，不如不写这个预设）',
    )
  }
  for (const [index, group] of list.entries()) {
    const where = `第 ${index + 1} 组${group?.name ? `（${group.name}）` : ''}`
    if (typeof group?.name !== 'string' || group.name.length === 0) {
      throw new AdapterError(`callSites() ${where} 缺少 name：组名会出现在报告里，不能为空`)
    }
    if ((!Array.isArray(group.apis) || group.apis.length === 0) && !group.from) {
      throw new AdapterError(
        `callSites() ${where} 既没给 apis 也没给 from：这一组什么都判不了\n` +
          `（apis: 自己列调用名；from: 指向既有清单 ${CALL_SITE_SOURCE_IDS.join(' / ')}）`,
      )
    }
    if (!Array.isArray(group.in) || group.in.length === 0) {
      throw new AdapterError(`callSites() ${where} 的 in 不能为空：写清"只许出现在哪些落点"`)
    }
    if (group.args !== undefined && (!Array.isArray(group.args) || group.args.length === 0)) {
      throw new AdapterError(
        `callSites() ${where} 的 args 不能是空数组：空名单会让"这一类调用"一组都不判
` + `（不要收窄就整条别写 args）`,
      )
    }
  }
  const names = new Set(list.map((group) => group.name))
  if (names.size !== list.length) {
    throw new AdapterError('callSites() 的组名要唯一：报告里靠它区分是哪一类调用')
  }
  return {
    enable: ['S38'],
    adapters: {
      'call-sites': defineAdapter<GenericAdapter>('call-sites', {
        id: 'declared',
        specVersion: '1',
        groups: list.map((group) => ({
          name: group.name,
          // 项目显式给了就带上；否则由 `from` 在判定时解析（引擎侧单一出处）
          ...(group.apis ? { apis: [...group.apis] } : {}),
          ...(group.from ? { from: group.from } : {}),
          ...(group.args ? { args: [...group.args] } : {}),
          in: [...group.in],
        })),
      }),
    },
  }
}
