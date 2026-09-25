/**
 * **CSS 数值三族**（D12 长度 / D13 层级 / D14 时长）的判据词汇（纯数据）。
 *
 * 为什么是数据：这三族的"哪些属性算长度、单位有哪些"是通用 CSS 词汇，不是逻辑；
 * 放在数据表里，规则本身只有一条（"该族声明的白名单之外的数值就报"）。
 *
 * 白名单**由项目声明**（`designSystem({ valueWhitelists })`）—— 间距刻度、层级刻度、动效时长
 * 每个项目都不同，猜一个默认值必然误报。没声明那一族 → 不判。
 */
export interface CssValueFamily {
  /** 规则 id（D12 / D13 / D14） */
  rule: string
  /** 人读名（进报告） */
  title: string
  /** 属性名前缀：`margin` 命中 `margin-top` / `margin-inline` 等 */
  properties: string[]
  /** 该族允许的单位（空数组 = 只看纯数字，如 z-index） */
  units: string[]
  /** 修法提示 */
  hint: string
}

export const cssValueFamilies: CssValueFamily[] = [
  {
    rule: 'D12',
    title: '长度',
    properties: [
      'margin',
      'padding',
      'gap',
      'top',
      'right',
      'bottom',
      'left',
      'width',
      'height',
      'font-size',
      'line-height',
      'border-radius',
      'border-width',
      'outline-width',
      'letter-spacing',
    ],
    units: ['px', 'rem', 'em'],
    hint: '间距 / 尺寸走令牌或无单位变量；项目认可的那几个刻度写进 designSystem({ valueWhitelists })',
  },
  {
    rule: 'D13',
    title: '层级',
    properties: ['z-index'],
    units: [],
    hint: '层级集中登记（0 / 1 / 10 / 100…），别出现 9999 —— 一旦有人跳级，后面的人只能跟着跳',
  },
  {
    rule: 'D14',
    title: '时长',
    properties: ['transition-duration', 'animation-duration', 'transition', 'animation'],
    units: ['ms', 's'],
    hint: '动效时长走令牌，别每处写一个数 —— 节奏感来自统一的那几个值',
  },
]
