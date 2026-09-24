import { DEFAULT_NAMING, DEFAULT_THRESHOLDS } from '../engine/defaults.js'
import type { Preset, RoleDescriptor } from '../engine/types.js'

export interface LibraryOptions {
  src?: string
  /**
   * 库的**目录表**：目录名 → 层号（层号越小越底层）。
   *
   * 这是库唯一的「结构声明」—— 库没有应用那套「业务域 / 共享层」的概念，
   * 它的结构就是「公开面入口 + 若干内部目录」。不传 = 只认入口，
   * 其余文件会以 S01「无处安放」报出来（这是有意的：目录表必须由项目声明，
   * 而不是本体替你猜）。
   */
  modules?: Record<string, number>
  /** 公开面入口（相对 src 的文件路径），默认 `['index.ts']` */
  entry?: string[]
}

/**
 * 库 / CLI 工具范式的角色表（对比 `canonical()` 的应用范式）。
 *
 * 为什么与应用范式分开：应用的目录契约（装配 / 业务域 / 共享）对库不成立 ——
 * 库没有业务域、没有路由分片、也没有别名（内部相对导入是 Node 生态的常规写法）。
 * 强行用应用规则去量库，只会得到一堆与设计无关的报错。
 *
 * 角色表由「入口 + 目录表」生成，因此同一份预设既能量第三方库，也能量本体自己：
 * ```js
 * library({ modules: { utils: 1, core: 2, transport: 3 } })          // 普通库
 * library({ modules: { data: 1, engine: 2, packs: 4, presets: 4 },    // 本体（arch.config.mjs）
 *           entry: ['index.ts', 'cli.ts'] })
 * ```
 */
export function libraryRoleTable(options: LibraryOptions = {}): RoleDescriptor[] {
  const src = options.src ?? 'src'
  const entry = options.entry ?? ['index.ts']
  const modules = options.modules ?? {}
  return [
    { id: 'test', pattern: '**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}', layer: 99, exclusive: true },
    { id: 'test', pattern: '**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}', layer: 99, exclusive: true },
    // 入口逐个成角色（而不是 `{index,cli}.ts` 花括号枚举）：花括号里的 `.` 不转义，会匹配到 `indexXts`
    ...entry.map((file) => ({
      id: 'lib:entry',
      pattern: `${src}/${file}`,
      layer: 10,
      slot: 'entry',
    })),
    // 内部目录：id 用 `lib:<目录名>`，层号由项目给 —— 故意**不设 slot**，
    // 免得目录名恰好叫 lib / hooks 时套上应用范式那套槽位语义（S13 等会误判）
    ...Object.entries(modules).map(([dir, layer]) => ({
      id: `lib:${dir}`,
      pattern: `${src}/${dir}/**`,
      layer,
    })),
  ]
}

/**
 * 库范式预设：库的角色表 + 只启用与库相关的规则。
 * `S10`（禁相对越级 / 必须走别名）是应用专属规则 —— 库没有别名约定，关掉。
 */
export function library(options: LibraryOptions = {}): Preset {
  const src = options.src ?? 'src'
  return {
    paradigm: 'library',
    roles: libraryRoleTable(options),
    // 库没有应用那套「装配 / 域 / 共享」：app 就是源码根，modules / shared 置空表示**不存在**。
    // 依赖它们的图规则（S04–S09、S15、S18、S03）会因此自然空转，而不是去查一个不存在的
    // `${srcRoot}/modules` 假装检查过（那曾经是假绿来源，见 structure-graph 的 rootsOf 注释）。
    layout: { app: src, modules: '', shared: '' },
    srcRoot: src,
    // 与 canonical() 同一份默认值：库范式只是工程形态不同，阈值与命名契约并不因此改变
    naming: { ...DEFAULT_NAMING },
    thresholds: { ...DEFAULT_THRESHOLDS },
    entries: (options.entry ?? ['index.ts']).map((file) => `${src}/${file}`),
    // 契约扫描域：只有 src 下的 ts/css 参与角色判定。构建产物、示例宿主、夹具、工具配置
    // 都在域外 —— 既不该参与角色判定，也不该被解析（见 .scratch/include-scope/spec.md）。
    include: [`${src}/**`],
    ignore: ['arch.config.mjs', 'arch.config.js', '.agents/**'],
    // S21 是「分层单向」——它不是应用专属，库/自定义目录表靠它把层号变成可判定红线
    enable: [
      'S00',
      'S01',
      'S02',
      'S11',
      'S12',
      'S13',
      'S16',
      'S21',
      'S22',
      'S23',
      // 扫描域非空：库也一样——`include`/`entry` 写错就会「0 个文件 → 通过」
      'S24',
      // 声明驱动的组规则（结构声明化）：组完整性 / 保留名 / 规模阈值
      'S25',
      'S26',
      'S27',
      'S28',
      'S29',
      'S30',
      'S31',
      'S32',
      'S35',
      'P01',
      'P02',
      'P06',
    ],
    // 层号不是装饰：库/自定义目录表靠 S21 把「只许依赖层号 ≤ 自己」变成红线
    structure: { order: true },
  }
}
