import type { Config } from '../../../engine/types.js'

/**
 * S01 / S03 的「该去哪」提示：照着**这个文件的位置**给下一步。
 *
 * 为什么值得单独写：目录契约是封闭枚举，报「未命中任何角色」只是说"你错了"，
 * 而迁移中的项目（或 agent）需要的是"放哪"。提示是纯文本，不参与判定，
 * 所以它可以把范式里的落点表直接念出来 —— 这是让"按范式来"可执行的那一半。
 */
export function placementHint(rel: string, config: Config): string {
  const { app, modules, shared } = config.layout
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
    const inDomain = rel.slice(modules.length + 1).split('/')
    if (inDomain.length === 2) {
      return (
        '域根只放 routes.tsx：页面进 views/、域内类型与常量进 model/、' +
        '纯函数进 lib/、域内组件进 components/'
      )
    }
    return (
      '域内只有七个槽位（routes.tsx / views/ / components/ / hooks/ / model/ / lib/ / assets/）：' +
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
