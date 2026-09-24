import type { Preset, RoleDescriptor } from '../engine/types.js'

import { library } from './library.js'

export interface FsdOptions {
  /** 源码根，默认 `src` */
  src?: string
  /** 有切片的层：层名 → 层号（越小越底层）。默认 FSD 的 pages/widgets/features/entities */
  slicedLayers?: Record<string, number>
  /** 无切片层（`app`）的层号，默认为最高层 */
  appLayer?: number
  /** 无切片层（`shared`）的层号，默认为最低层 */
  sharedLayer?: number
  /** 切片内允许的片段（**封闭枚举**：没列到的片段会被 S01 报出来） */
  segments?: string[]
  /** `shared` 下允许的片段 */
  sharedSegments?: string[]
  /** `app` 下允许的片段 */
  appSegments?: string[]
  /**
   * 是否使用**分组切片**（`features/auth/login/...`）。
   *
   * 必须显式打开：两种形态的路径无法用一组 glob 同时表达 ——
   * `src/features/{group}/{slice}/{seg}/**` 会把不带分组的 `features/crew-filter/ui/X.tsx`
   * 也匹配上（`{seg}` 吃掉 `ui`），于是同一个文件命中两个角色 → S01「角色歧义」。
   */
  slicesGrouped?: boolean
}

/**
 * FSD 的约定片段（按**用途**命名，而不是按内容）。
 *
 * 这几个名字都过了 `segments-by-purpose` 的检查 —— 该规则禁用按**内容**命名的片段：
 * `components` `helpers` `utils` `constants` `types` `stores` `services` **`assets`** `hooks` `context`
 * **`providers`** `composables` … （词表见 steiger 的 `segments-by-purpose` 文档）
 *
 * 所以默认值里**故意不含 `assets` / `providers`** —— 它们很常见，但会被社区官方 linter 判为"按内容命名"。
 * 需要就显式加：`fsd({ sharedSegments: [..., 'assets'], appSegments: [..., 'providers'] })`。
 */
const DEFAULT_SEGMENTS = ['ui', 'model', 'api', 'lib', 'config']
const DEFAULT_SHARED_SEGMENTS = ['ui', 'lib', 'api', 'config', 'i18n']
const DEFAULT_APP_SEGMENTS = ['router', 'styles', 'i18n']

/**
 * Feature-Sliced Design 范式的角色表 [^fsd]。
 *
 * 三层模型全部落成**数据**：层 → 层号；切片 → `group: 'slice'`（组维度）；
 * 片段 → **封闭枚举**（没登记就 S01）；公开面 → 切片的 `index.ts`，用 `entry: true` 标记。
 *
 * 于是 FSD 的规矩由通用规则判定，引擎里没有一行 FSD 字面量：
 * 层序单向 = S21 · 同层切片不许互引 = S22 · 切片必须有公开面且不许绕过 = S23 ·
 * 层名/片段名的封闭枚举 = S01（`processes` 这层被删掉后也自动报出来）。
 *
 * [^fsd]: <https://feature-sliced.design/> —— 本预设跟随社区规范；规范演进时改这里，规则不动。
 */
export function fsdRoleTable(options: FsdOptions = {}): RoleDescriptor[] {
  const src = options.src ?? 'src'
  const sliced = options.slicedLayers ?? { pages: 5, widgets: 4, features: 3, entities: 2 }
  const appLayer = options.appLayer ?? 6
  const sharedLayer = options.sharedLayer ?? 1
  const segments = options.segments ?? DEFAULT_SEGMENTS
  const sharedSegments = options.sharedSegments ?? DEFAULT_SHARED_SEGMENTS
  const appSegments = options.appSegments ?? DEFAULT_APP_SEGMENTS
  const grouped = options.slicesGrouped === true

  const roles: RoleDescriptor[] = [
    { id: 'test', pattern: '**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}', layer: 99, exclusive: true },
    { id: 'test', pattern: '**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}', layer: 99, exclusive: true },
  ]

  // app：**无切片层** —— 直接就是片段（FSD 的 sliceless layer）
  roles.push(
    { id: 'fsd:app:index', pattern: `${src}/app/index.{ts,tsx}`, layer: appLayer },
    { id: 'fsd:app:main', pattern: `${src}/app/main.{ts,tsx}`, layer: appLayer },
    ...appSegments.map((segment) => ({
      id: `fsd:app:${segment}`,
      pattern: `${src}/app/${segment}/**`,
      layer: appLayer,
    })),
  )

  // 有切片的层：切片根只放 `index.ts`（公开面），片段各自一个角色
  const slice = grouped ? '{group}/{slice}' : '{slice}'
  for (const [layer, layerNumber] of Object.entries(sliced)) {
    roles.push({
      id: `fsd:${layer}:index`,
      pattern: `${src}/${layer}/${slice}/index.{ts,tsx}`,
      layer: layerNumber,
      group: 'slice',
      entry: true,
    })
    roles.push(
      ...segments.map((segment) => ({
        id: `fsd:${layer}:${segment}`,
        pattern: `${src}/${layer}/${slice}/${segment}/**`,
        layer: layerNumber,
        group: 'slice',
      })),
    )
  }

  // shared：无切片层
  roles.push(
    ...sharedSegments.map((segment) => ({
      id: `fsd:shared:${segment}`,
      pattern: `${src}/shared/${segment}/**`,
      layer: sharedLayer,
    })),
  )

  return roles
}

/**
 * FSD 范式预设：角色表 + 三条结构声明。
 *
 * ```js
 * presets: [fsd(), designSystem({ … }), copy({ … }), deps({ … }), hygiene(), uiKit(noneKit())]
 * ```
 *
 * 基础沿用库范式（`layout.modules` / `layout.shared` 置空 → 三根那套 S03–S09/S15/S18 自然空转，
 * 不会去查不存在的目录假装检查过）。
 */
export function fsd(options: FsdOptions = {}): Preset {
  const src = options.src ?? 'src'
  return {
    ...library({ src, entry: [] }),
    // 覆盖 library 的范式标识：FSD 也是一个范式，不能和库范式混用
    paradigm: 'fsd',
    roles: fsdRoleTable(options),
    // FSD 的契约落点：令牌放 `shared/ui/styles`（**不需要**额外加片段 —— ui 本来就是 FSD 片段），
    // 于是 `[fsd(), designSystem()]` 开箱即符合 FSD 目录，不用手写一堆路径
    params: {
      styleDir: `${src}/shared/ui/styles`,
      tokenDir: `${src}/shared/ui/styles/tokens`,
      vendorDir: `${src}/shared/ui/styles/vendor`,
      paletteFile: `${src}/shared/ui/styles/tokens/palette.css`,
      themeFile: `${src}/shared/ui/styles/tokens/theme.css`,
      storageFile: `${src}/shared/config/storage.ts`,
      i18nDir: `${src}/shared/i18n/locales`,
    },
    // FSD 的三条结构规矩，全部由**通用规则**判：
    //   order     → S21 层序单向（app 6 > pages 5 > widgets 4 > features 3 > entities 2 > shared 1）
    //   isolate   → S22 同层切片不许互相引用
    //   publicApi → S23 切片必须有 index.ts，且不许绕过它直引内部
    structure: { order: true, isolate: ['slice'], publicApi: ['slice'] },
  }
}
