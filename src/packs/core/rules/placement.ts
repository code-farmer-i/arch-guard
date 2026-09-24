import type { Config } from '../../../engine/types.js'

import { routeFilesOf } from './face-forms.js'

/**
 * S01 / S03 的「该去哪」提示：照着**这个文件的位置**给下一步。
 *
 * 为什么值得单独写：目录契约是封闭枚举，报「未命中任何角色」只是说"你错了"，
 * 而迁移中的项目（或 agent）需要的是"放哪"。提示是纯文本，不参与判定，
 * 所以它可以把范式里的落点表直接念出来 —— 这是让"按范式来"可执行的那一半。
 */
export function placementHint(rel: string, config: Config): string {
  const { app, modules, shared } = config.layout
  /**
   * FSD 必须**先认出来**：它的 `layout` 也是 `library()` 那套（`modules` / `shared` 都是空串），
   * 不看 `paradigm` 就会掉进下面的库分支，给出「先在 `library({ modules })` 里补上」这种
   * 完全不相干的建议（`--explain` 是"写之前问"的唯一工具，这一行错了等于工具失效）。
   */
  if (config.paradigm === 'fsd') return fsdPlacementHint(rel, config)
  // 库范式（没有域 / 共享层）：念出**项目声明过的目录表**——
  // 不能说应用范式那套「app 层只认 main/App/router/layouts」（库的 layout.app 就是源码根）
  if (modules === '' && shared === '') {
    const dirs = config.roles
      .filter((role) => role.id.startsWith('lib:') && role.id !== 'lib:entry')
      .map((role) => role.pattern.replace(`${config.srcRoot}/`, '').replace(/\/\*\*$/, ''))
    return dirs.length > 0
      ? `这个库声明的内部目录只有：${dirs.join(' / ')} —— 放进其中之一，或先在 library({ modules }) 里把它声明出来`
      : '这个库还没有声明任何内部目录：先在 library({ modules: { <目录名>: <层号> } }) 里补上'
  }
  if (rel.startsWith(`${app}/`)) {
    return (
      'app 层只认 main / App / router/** / layouts/**：装配套壳写进 App.tsx，' +
      '配置对象各自下沉 shared/（queryClient→shared/api、theme→shared/theme、store→shared/stores）'
    )
  }
  if (rel.startsWith(`${modules}/`)) {
    // 域入口叫什么由**方案面**声明（`router.routeFiles`，默认 routes.ts / routes.tsx）——
    // 提示念的是同一份词汇，不然"该放哪"会指着一个本方案不存在的文件名
    const routeFiles = routeFilesOf(config)
    const routes = routeFiles.join(' / ')
    const inDomain = rel.slice(modules.length + 1).split('/')
    if (inDomain.length === 2) {
      return (
        (routeFiles.length > 0 ? `域根只放 ${routes}` : '域根不该有文件（本方案未声明入口文件）') +
        '：页面进 views/、域内类型与常量进 model/、纯函数进 lib/、域内组件进 components/'
      )
    }
    // 词汇为空时"槽位表"里不含域入口 —— 别念一个不存在的槽位（那时是六个，不是七个）
    const slots =
      routeFiles.length > 0
        ? `七个槽位（${routes} / views/ / components/ / hooks/ / model/ / lib/ / assets/）`
        : '六个槽位（views/ / components/ / hooks/ / model/ / lib/ / assets/）'
    return (
      `域内只有${slots}：` +
      '放进其中之一；端点与契约类型统一进 shared/api/，客户端状态进 shared/stores/'
    )
  }
  if (rel.startsWith(`${shared}/components/`)) {
    return 'shared/components 下只有两个槽位：哑基础件进 ui/，业务中立组合件进 common/'
  }
  if (rel.startsWith(`${shared}/`)) {
    return (
      'shared 的槽位：styles/ assets/ lib/ config/ i18n/ api/ stores/ theme/ hooks/ ' +
      'components/{ui,common}'
    )
  }
  return '顶层只有 app/ modules/ shared/ 三根（PARADIGM.md §6.1）：先归到其中一根，再选槽位'
}

/**
 * FSD 的「该放哪」：**层 → 切片 → 片段**三级，而且片段的合法集合**按层不同**（app 与 shared 无切片）。
 *
 * 全部从**角色表**读（`slicedLayers` / `segments` / `appSegments` / `sharedSegments` 都可配），
 * 所以自定义过的 FSD 也能给对 —— 而不是复述一份写死的目录表。
 */
function fsdPlacementHint(rel: string, config: Config): string {
  const src = config.srcRoot
  const sliced = new Map<string, Set<string>>()
  const flat = new Map<string, Set<string>>()
  const add = (target: Map<string, Set<string>>, layer: string, segment: string): void => {
    const bucket = target.get(layer) ?? new Set<string>()
    bucket.add(segment)
    target.set(layer, bucket)
  }
  for (const role of config.roles) {
    const parts = role.id.split(':')
    if (parts[0] !== 'fsd' || parts.length !== 3) continue
    const layer = parts[1] as string
    const segment = parts[2] as string
    if (segment === 'index' || segment === 'main') continue
    if (role.group === 'slice') add(sliced, layer, segment)
    else add(flat, layer, segment)
  }
  const layers = [...sliced.keys()]
  const appSegments = [...(flat.get('app') ?? [])]
  const sharedSegments = [...(flat.get('shared') ?? [])]
  const rest = rel.startsWith(`${src}/`) ? rel.slice(src.length + 1) : rel
  const [first = '', second] = rest.split('/')

  if (first === 'app') {
    return `app 是**无切片层**：只认 index / main 与片段 ${appSegments.join(' / ')}；套壳写进 app/index，配置对象进 shared/`
  }
  if (first === 'shared') {
    return `shared 是**无切片层**（不该有业务逻辑）：只认片段 ${sharedSegments.join(' / ')}`
  }
  if (sliced.has(first)) {
    const segments = [...(sliced.get(first) ?? [])]
    if (second === undefined) {
      return `${first}/ 下要建**切片**目录：${first}/<切片名>/<片段>/… —— 切片名用业务域词（crews / crew-filter 这种）`
    }
    return `${first}/<切片名>/ 下只认这些片段：${segments.join(' / ')}；切片的公开面是它的 index.ts（组外只许从那里引）`
  }
  return (
    `FSD 六层：app/ ${layers.map((layer) => `${layer}/`).join(' ')}shared/ —— 先选层；` +
    '除 app 与 shared 外都是「层 / 切片 / 片段」三级'
  )
}
