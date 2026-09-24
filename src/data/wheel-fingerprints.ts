/**
 * 能力表 + 手工轮子指纹（纯数据）。
 *
 * 设计要点（见 docs/DESIGN.md §16）：
 * - 「该不该用成熟库」本身是 L5 判断；这里只钉**可判定的后果**：
 *   能力 → 首选库；以及「手工实现」的语法/命名指纹。
 * - 两档证据：`syntax` 单证据即报（形态无歧义）；`softSyntax` 必须与 `apiNames` 叠加才报（防误伤）。
 * - `allowOwn` 为 true 的能力只提示不报错 —— 有些小工具自研是合理的。
 * - 引擎与规则里不出现任何具体库名：库名只在本表与适配器里。
 *
 * **登记能力 ≠ 禁用语言原语**（这条常被问）：能力表要求的是「这个能力的**活**走登记方案」，
 * 所以指纹只钉**手搓库的那部分**（格式化 / 取分量 / 字符串解析 / 手算日期差）。
 * `new Date()`、`Date.now()`（取当前时刻）、`new Date(ms)`（时间戳）是原生原语、不是手搓库 ——
 * 它们**不在任何指纹里**，也不该在：禁掉只会让时间戳与耗时计算处处误报。
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
      // 人类可读格式化同样该走 dayjs；**机器格式 `toISOString()` 不在此列**（那是序列化，不是手搓）
      '\\.to(?:DateString|TimeString|UTCString)\\(\\)',
      '\\bIntl\\.DateTimeFormat\\b',
      '\\.toISOString\\(\\)\\s*\\.\\s*slice\\(',
      '\\bYYYY[-/]MM[-/]DD\\b',
      /**
       * 手动取 / 改日期分量：**按族写，不再一条条列**。
       *
       * `Date` 的实例方法是 **ECMAScript 封闭集合**（不会像库名那样过期），所以按族枚举既全又不飘：
       * 之前只列了 `getFullYear / getMonth / getDate / getHours / getMinutes` —— `getDay`、`getSeconds`、
       * `getUTCFullYear` 以及**全部 setter** 都漏在外面（实测 `d.getDay()` 一条都不报）。
       *
       * 为什么不用更省事的宽模式 `\.get[A-Z]\w*\(\)`：实测在**本仓 + 29 个夹具**里它命中 10 处，
       * 其中 4 处是误伤（`scanner.getTokenPos()` / `scanner.getTextPos()` / `node.getEnd()`）——
       * 宽模式会把任何 `getXxx()` 都当成日期分量。显式族模式同范围命中 6 处，**全是真 Date 用法**。
       *
       * 刻意**不含 `getTime` / `setTime`**：`d.getTime()` 取时间戳是合法原生用法（dayjs 未必替得掉），
       * 毫秒级手算由下面两条"与 4 位以上数字运算"的指纹专门管 —— 守住"只报手搓库的活"这条边界。
       */
      '\\.get(?:FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds|TimezoneOffset|Year|UTC(?:FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds))\\(\\)',
      '\\.set(?:FullYear|Month|Date|Hours|Minutes|Seconds|Milliseconds|Year|UTC(?:FullYear|Month|Date|Hours|Minutes|Seconds|Milliseconds))\\(',
      // 用毫秒数手算日期差
      'Date\\.now\\(\\)\\s*[-+]\\s*\\d{4,}',
      'new Date\\([^)]*\\)\\.getTime\\(\\)\\s*[-+]\\s*\\d{4,}',
      // 字符串日期**解析**：`Date.parse` 这个 API 只用于解析（几乎零误报）；
      // `new Date('…')` 只认**字面量**参数 —— `new Date(variable)` 可能是时间戳，静态判不出，
      // 宁可不管也不要误伤（那条边界写在 note 里）。
      '\\bDate\\.parse\\(',
      'new Date\\(\\s*[\'"]',
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
    // P07（自造轮子）用**弱指纹**：这些写法本身正常，但和"自研了 formatDate/parseDate 这类函数"叠一起
    // 就是"手搓了一个日期库"。弱指纹门槛低没关系 —— P07 还要求**同名自研**才报，而且只是 warn。
    // P07 的精度由**命名指纹**（自研了 formatDate / parseDate 这类函数）把门，所以弱指纹可以放宽成族
    softSyntax: ['new Date\\(', '\\.get[A-Z]\\w*\\(', '\\.set[A-Z]\\w*\\('],
    hint: "用 dayjs：dayjs(x).format('YYYY-MM-DD')、dayjs(x).add(1, 'day')",
    note:
      'antd 内部就用 dayjs，用了组件库的项目基本已经间接装了它。' +
      '**边界**：`new Date()` / `Date.now()`（取当前时刻）与 `new Date(ms)`（时间戳）**不管** —— ' +
      '它们是原生原语、不是"手搓库"，禁掉只会制造误报；管的是**手搓格式化 / 取分量 / 字符串解析**，' +
      '即真正该由 dayjs 接管的那部分。',
  },
  {
    capability: 'cli-args',
    preferred: ['commander'],
    syntax: [
      // 按 argv 的**用法**成族，而不是只列几个方法：索引取值 `process.argv[2]` 与
      // `filter/forEach/map/reduce/…` 都同样是"手写 argv 解析"
      'process\\.argv\\[',
      'process\\.argv\\.(?:slice|indexOf|includes|splice|find|filter|forEach|map|reduce|some|every)\\(',
    ],
    // `apiNames` 必须与 `softSyntax` 成对才有意义（P07 = 弱指纹 **且** 自研同名）——
    // 只写 apiNames 等于声明了一个永远不会被读的命名指纹
    softSyntax: ['\\bargv\\b', 'startsWith\\([\'"]-'],
    apiNames: ['parseArgs', 'parseCli', 'parseFlags', 'readFlag', 'argParser', 'getOption'],
    hint: '用 commander：new Command().option("--x <v>").parse(argv)',
    note: '手写 argv 解析会在 --key=value / 短选项 / 帮助文本 / 未知参数上逐个踩坑',
  },
  {
    capability: 'deep-clone',
    preferred: ['structuredClone'],
    platform: true,
    syntax: ['JSON\\.parse\\(\\s*JSON\\.stringify\\('],
    // 自研**递归**克隆（不走 JSON 技巧）只有弱指纹抓得到：与"导出了 deepClone/cloneDeep/deepCopy 这类名字"叠加才算。
    // 此前该条目**没有 softSyntax** → P07 对 deep-clone 永不参与，等于漏了一半
    softSyntax: [
      'Object\\.assign\\(',
      'Array\\.isArray\\(',
      '\\.hasOwnProperty\\(',
      'Reflect\\.ownKeys\\(',
    ],
    apiNames: ['deepClone', 'cloneDeep', 'deepCopy'],
    hint: '用结构化克隆：structuredClone(x)（Node 17+ / 浏览器内置）；要保留类实例再用成熟库',
  },
  {
    capability: 'unique-id',
    preferred: ['crypto.randomUUID'],
    platform: true,
    syntax: [
      // 进制成族（16/36 之外还有 2/8/10）；`toString()` 后接 slice 也是同一类手搓 ID
      'Math\\.random\\(\\)\\.toString\\((?:2|8|10|16|36)\\)',
      'Math\\.random\\(\\)\\.toString\\(\\)\\.(?:slice|substring|substr)\\(',
      'Date\\.now\\(\\)\\.toString\\((?:16|36)\\)',
      // 流传很广的 uuid v4 手搓片段：`([1e7]+-1e3-4e3-8e3-1e11).replace(...)`
      '\\[1e7\\]\\+-1e3',
    ],
    softSyntax: ['Math\\.random\\(', 'Date\\.now\\(\\)'],
    apiNames: ['uuid', 'generateId', 'uniqueId', 'nanoid', 'randomId'],
    hint: '用平台内置：crypto.randomUUID()（需要短 ID 用 nanoid）',
  },
  {
    capability: 'number-format',
    preferred: ['Intl.NumberFormat'],
    platform: true,
    syntax: [
      '\\.toFixed\\(\\d+\\)\\.replace\\(',
      // 千分位分组成族：不管写成 `\B(?=(\d{3})` 还是 `(\d)(?=(\d{3})+(?!\d))`，
      // 正则里出现 `\d{3}` 就是同一个手搓
      'replace\\(/[^/]*\\\\d\\{3\\}[^/]*/',
    ],
    softSyntax: ['\\.toFixed\\(', '\\.toLocaleString\\('],
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
    // `==` / `===` / `!=` / `!==` 都是同一类错误（宽松相等更常见）；只认 `===` 会漏一半
    syntax: ['JSON\\.stringify\\([^)]*\\)\\s*[!=]==?\\s*JSON\\.stringify\\('],
    softSyntax: ['JSON\\.stringify\\('],
    apiNames: ['deepEqual', 'isEqual', 'deepCompare', 'objectsEqual'],
    hint: '用 isDeepStrictEqual(a, b)（Node 内置）或成熟库的 isEqual；JSON 比较会漏掉键顺序与 undefined',
  },
  {
    capability: 'query-string',
    preferred: ['URLSearchParams'],
    platform: true,
    syntax: [
      // 拼查询串的三种写法：`'?' + x`、`'?'.concat(x)`、模板串 `` `?${x}` ``
      '[\'"]\\?[\'"]\\s*(?:\\+|\\.concat\\()',
      '`\\?\\$\\{',
      'join\\([\'"]&[\'"]\\)',
      // 手写 k=v 编码（URLSearchParams 自带编码）
      'encodeURIComponent\\([^)]*\\)\\s*\\+\\s*[\'"]=[\'"]',
    ],
    softSyntax: ['encodeURIComponent\\('],
    apiNames: ['buildQuery', 'serializeQuery', 'parseQuery', 'toQueryString'],
    hint: '用 new URLSearchParams({ ... }).toString()（平台内置，自动处理编码）',
    allowOwn: true,
  },
  {
    capability: 'debounce-throttle',
    preferred: ['lodash-es'],
    softSyntax: [
      'clearTimeout\\(',
      'setTimeout\\(',
      // 手搓 throttle 常见写法：rAF 节流、按 performance.now() 差值限流
      'requestAnimationFrame\\(',
      'performance\\.now\\(\\)\\s*-',
    ],
    apiNames: ['debounce', 'throttle', 'rateLimit'],
    hint: '用成熟实现（lodash-es 的 debounce/throttle，或项目既有的 hook 库）；手写版常漏掉取消防抖与 this/参数转发',
    allowOwn: true,
  },
  {
    capability: 'validation',
    preferred: ['zod'],
    softSyntax: ['test\\(\\s*[A-Za-z_]', 'new RegExp\\(', '\\.match\\(', '\\.exec\\('],
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
