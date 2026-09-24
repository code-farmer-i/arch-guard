import { defineAdapter } from '../../engine/adapters.js'
import type { UiKitAdapter } from '../../engine/types.js'

/**
 * antd 适配器：**唯一允许出现库名的地方**（引擎与通用预设里都不许出现）。
 * 换库 = 抄一份这个文件改字段；不用组件库 = 用 ui-kits/none。
 */
export function antdKit(): UiKitAdapter {
  return defineAdapter<UiKitAdapter>('ui-kit', {
    id: 'antd',
    specVersion: '1',
    // `packages` = **你必须装的**（P04 正向会要求它在 package.json 里），不是"这套库的全部包"。
    // `@ant-design/x`（AI 界面套件）属于 antd 这一套，但是**可选扩展** —— 放进这里就会逼所有项目装它。
    // 它仍然登记在 `data/kit-fingerprints.ts` 的 antd 条目里，所以：装了它不会被判"混进别的组件库"；
    // 而 `allow` 已开启时，装了什么就得自己写进 allow（那是项目决定，不是适配器替你决定）。
    packages: ['antd', '@ant-design/icons'],
    icons: { from: ['@ant-design/icons'] },
    vendorSelectors: ['\\.ant-'],
    vendorVars: ['^--ant-'],
    detachedApis: [
      {
        from: ['antd'],
        members: ['message', 'notification'],
        kind: 'call',
        suggest: 'App.useApp() 取 message/notification（静态方法不继承主题上下文）',
      },
      {
        from: ['antd'],
        members: ['Modal'],
        kind: 'static-call',
        suggest: '<Modal /> 组件或 App.useApp() 的 modal',
      },
    ],
    // 注：第三方覆盖的落点（如 `src/shared/styles/vendor`）与主题集成文件是**项目决定**，
    // 由 `designSystem({ vendorDir, themeFile })` 与目录规范声明 —— 适配器不该决定项目目录。
    examples: {
      vendorSelectors: { hit: ['.ant-btn', '.ant-table-cell'], miss: ['.my-card', '.sh-panel'] },
      vendorVars: { hit: ['--ant-color-primary'], miss: ['--sh-alias-brand-primary'] },
    },
  })
}
