/**
 * **调用落点组的「来源」清单**（纯数据）：`callSites([{ name, from, in }])` 里 `from` 指向哪里拿 API 名。
 *
 * 为什么需要：一个组要说的其实是"**这类调用**只许出现在**这个家**"。而"这类调用叫什么"经常不是项目的事实 ——
 * `localStorage` 是浏览器平台的、`QueryClient` 是 react-query 的、`gtag` 是分析方案的。让每个宿主抄一遍
 * `apis: ['localStorage']` 就是"把别处已有的知识再写一次"，写错一个字母还会静默少判（R-75 那一族）。
 *
 * 数据表只收**平台**的（库的走它自己的适配器：`analytics.apis` / `data-layer.singletons`）——
 * 库名放数据表会与适配器里的同一事实分成两处。
 */
export const CALL_SITE_SOURCES: Record<string, string[]> = {
  /** 浏览器存储：隐私判断 / 加密的统一出口 */
  'platform.storage': ['localStorage', 'sessionStorage'],
  /** 定时器：泄漏与测试假时钟的统一出口 */
  'platform.timers': ['setTimeout', 'setInterval'],
  /** 网络：换 SDK、加统一错误处理与鉴权的统一出口 */
  'platform.network': ['fetch', 'XMLHttpRequest'],
  /**
   * 分析方案的**裸上报调用**（要收进项目自己的封装里，别处只调封装）。
   *
   * 注意与 `analytics({ apis })` 的区别：那个面声明的是**项目自己的封装调用**
   * （如 `sendEvent(...)`，允许在业务里调，只要事件名来自唯一出处）；这里声明的是**厂商 API**，
   * 只许出现在封装里。两者同名会让人以为是一件事。
   */
  'analytics.gtag': ['gtag'],
  'analytics.segment': ['analytics.track', 'analytics.identify'],
  'analytics.sentry': ['Sentry.captureException', 'Sentry.captureMessage'],
}

/** 面适配器提供的来源（名字 → 从哪个面的哪个字段取） */
export const CALL_SITE_FACET_SOURCES: Record<string, { facet: string; field: string }> = {
  'data-layer.singletons': { facet: 'data-layer', field: 'singletons' },
  // 库自己的适配器：`axiosKit()` 声明"哪些调用算打后端"，`endpoints({ from: callSiteSources.http.apis })` 直接用
  'http.apis': { facet: 'http', field: 'apis' },
}

/** 全部可用来源 id（配置期校验用：写错就报错，而不是安静地 0 个 API 名） */
export const CALL_SITE_SOURCE_IDS: string[] = [
  ...Object.keys(CALL_SITE_SOURCES),
  ...Object.keys(CALL_SITE_FACET_SOURCES),
]

/**
 * **给宿主用的常量命名空间**：`from: callSiteSources.platform.storage` 而不是手打 `'platform.storage'`。
 *
 * 为什么：字符串写错一个字母，用户只能靠报告事后发现；常量能被编辑器补全、能重构、能进文档。
 * 它**从 `CALL_SITE_SOURCE_IDS` 派生**（单一出处）—— 加一个来源只要加在表里，这里自动有，
 * 不会出现"第二份清单漂移"（同 `NOTICE` / `SKIP` 的形态，见 DESIGN §6.9）。
 *
 * `'data-layer.singletons'` → `callSiteSources.dataLayer.singletons`（段名转小驼峰当键，值仍是 id）。
 */
function nestSources(ids: string[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const id of ids) {
    const [head, tail] = id.split('.')
    if (!head || !tail) continue
    const group = head.replace(/-(\w)/g, (_, char: string) => char.toUpperCase())
    out[group] = { ...(out[group] ?? {}), [tail]: id }
  }
  return out
}

/** 结构化常量：`callSiteSources.platform.storage` · `callSiteSources.analytics.gtag` · `callSiteSources.dataLayer.singletons` */
export const callSiteSources: Record<string, Record<string, string>> = nestSources(
  CALL_SITE_SOURCE_IDS,
)
