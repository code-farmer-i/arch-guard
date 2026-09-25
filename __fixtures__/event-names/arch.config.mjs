import { analytics, canonical } from '../../es/index.js'

/**
 * 场景：`track('crews_view')` 的事件名在各处手拼 —— 改名漏一处就是数据断层，分析平台不会报错。
 * 声明唯一出处后：直接把字面量传给埋点调用就报；传常量表里的键（`track(EVENTS.crewsView)`）不报。
 * 未声明的 API（`gtag`）不判 —— `apis` 清单是项目责任（多参数 API 请包一层单参数 wrapper 再声明，
 * 因为 facts 只记第一个字符串实参）。
 */
export default {
  presets: [
    canonical(),
    analytics({ apis: ['track'], eventSource: 'src/shared/lib/analytics/events.ts' }),
  ],
  overrides: { enable: ['D24'], ignore: ['arch.config.mjs', 'expect.json'] },
}
