/**
 * 能力表 + 手工轮子指纹（纯数据）。
 *
 * 设计要点（见 docs/DESIGN.md §16）：
 * - 「该不该用成熟库」本身是 L5 判断；这里只钉**可判定的后果**：
 *   能力 → 首选库；以及「手工实现」的语法/命名指纹。
 * - 两档证据：`syntax` 单证据即报（形态无歧义）；`softSyntax` 必须与 `apiNames` 叠加才报（防误伤）。
 * - `allowOwn` 为 true 的能力只提示不报错 —— 有些小工具自研是合理的。
 * - 引擎与规则里不出现任何具体库名：库名只在本表与适配器里。
 */

export interface WheelFingerprint {
  /** 能力标识（选型表里的键） */
  capability: string
  /** 登记的首选方案（包名或平台内置） */
  preferred: string[]
  /** 是否平台内置（无需依赖） */
  platform?: boolean
  /** 强指纹：单证据即报（可缺省，表示该能力只能靠弱指纹 + 命名指纹判定） */
  syntax?: string[]
  /** 弱指纹：需与命名指纹叠加 */
  softSyntax?: string[]
  /** 该能力的常见公开 API 名（命名指纹：自研模块导出名重合 ≥2 即疑似） */
  apiNames?: string[]
  /** 报错时给的推荐写法 */
  hint: string
  /** 允许项目内自研（只提示，不报错） */
  allowOwn?: boolean
  note?: string
}

export const wheelFingerprints: WheelFingerprint[] = [
  {
    capability: 'datetime',
    preferred: ['dayjs'],
    syntax: [
      // 手搓格式化：locale API / 模板串 / 手动拼年月日
      '\\.toLocaleDateString\\(',
      '\\.toLocaleTimeString\\(',
      '\\.toLocaleString\\(',
      '\\bIntl\\.DateTimeFormat\\b',
      '\\.toISOString\\(\\)\\s*\\.\\s*slice\\(',
      '\\bYYYY[-/]MM[-/]DD\\b',
      // 手动取日期分量（这些方法只存在于 Date 上，误报率低）
      '\\.getFullYear\\(\\)',
      '\\.getMonth\\(\\)\\s*\\+\\s*1',
      '\\.getDate\\(\\)',
      '\\.getHours\\(\\)',
      '\\.getMinutes\\(\\)',
      // 用毫秒数手算日期差
      'Date\\.now\\(\\)\\s*[-+]\\s*\\d{4,}',
      'new Date\\([^)]*\\)\\.getTime\\(\\)\\s*[-+]\\s*\\d{4,}',
    ],
    apiNames: [
      'formatDate',
      'parseDate',
      'addDays',
      'diffDays',
      'isSameDay',
      'startOfDay',
      'endOfDay',
      'formatTime',
      'dateRange',
      'toDateString',
    ],
    hint: "用 dayjs：dayjs(x).format('YYYY-MM-DD')、dayjs(x).add(1, 'day')",
    note: 'antd 内部就用 dayjs，用了组件库的项目基本已经间接装了它',
  },
  {
    capability: 'cli-args',
    preferred: ['commander'],
    syntax: ['process\\.argv\\.(slice|indexOf|includes|splice|find)\\('],
    apiNames: ['parseArgs', 'parseCli', 'parseFlags', 'readFlag', 'argParser', 'getOption'],
    hint: '用 commander：new Command().option("--x <v>").parse(argv)',
    note: '手写 argv 解析会在 --key=value / 短选项 / 帮助文本 / 未知参数上逐个踩坑',
  },
  {
    capability: 'deep-clone',
    preferred: ['structuredClone'],
    platform: true,
    syntax: ['JSON\\.parse\\(\\s*JSON\\.stringify\\('],
    apiNames: ['deepClone', 'cloneDeep', 'deepCopy'],
    hint: '用结构化克隆：structuredClone(x)（Node 17+ / 浏览器内置）；要保留类实例再用成熟库',
  },
  {
    capability: 'unique-id',
    preferred: ['crypto.randomUUID'],
    platform: true,
    syntax: ['Math\\.random\\(\\)\\.toString\\(36\\)', 'Date\\.now\\(\\)\\.toString\\(36\\)'],
    apiNames: ['uuid', 'generateId', 'uniqueId', 'nanoid', 'randomId'],
    hint: '用平台内置：crypto.randomUUID()（需要短 ID 用 nanoid）',
  },
  {
    capability: 'number-format',
    preferred: ['Intl.NumberFormat'],
    platform: true,
    syntax: ['\\.toFixed\\(\\d+\\)\\.replace\\(', 'replace\\(/\\\\B\\(\\?=\\(\\\\d\\{3\\}\\)'],
    apiNames: [
      'formatNumber',
      'formatCurrency',
      'formatAmount',
      'thousands',
      'formatMoney',
      'toThousands',
    ],
    hint: "用 Intl：new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)",
  },
  {
    capability: 'deep-equal',
    preferred: ['node:util.isDeepStrictEqual'],
    platform: true,
    syntax: ['JSON\\.stringify\\([^)]*\\)\\s*===\\s*JSON\\.stringify\\('],
    apiNames: ['deepEqual', 'isEqual', 'deepCompare', 'objectsEqual'],
    hint: '用 isDeepStrictEqual(a, b)（Node 内置）或成熟库的 isEqual；JSON 比较会漏掉键顺序与 undefined',
  },
  {
    capability: 'query-string',
    preferred: ['URLSearchParams'],
    platform: true,
    syntax: ['\\?\\.concat\\(', 'join\\([\'"]&[\'"]\\)'],
    apiNames: ['buildQuery', 'serializeQuery', 'parseQuery', 'toQueryString'],
    hint: '用 new URLSearchParams({ ... }).toString()（平台内置，自动处理编码）',
    allowOwn: true,
  },
  {
    capability: 'debounce-throttle',
    preferred: ['lodash-es'],
    softSyntax: ['clearTimeout\\(', 'setTimeout\\('],
    apiNames: ['debounce', 'throttle', 'rateLimit'],
    hint: '用成熟实现（lodash-es 的 debounce/throttle，或项目既有的 hook 库）；手写版常漏掉取消防抖与 this/参数转发',
    allowOwn: true,
  },
  {
    capability: 'validation',
    preferred: ['zod'],
    softSyntax: ['test\\(\\s*[A-Za-z_]'],
    apiNames: [
      'validateEmail',
      'validatePhone',
      'validateUrl',
      'isEmail',
      'isPhone',
      'isUrl',
      'validateForm',
    ],
    hint: '用 schema 校验库（zod）声明式校验，别散着手写正则与 if',
    allowOwn: true,
    note: '组件库表单自带校验规则的，优先用它',
  },
]

export function capabilityOf(name: string): WheelFingerprint | undefined {
  return wheelFingerprints.find((entry) => entry.capability === name)
}
