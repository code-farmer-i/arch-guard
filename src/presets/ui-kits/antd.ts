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
    packages: ['antd', '@ant-design/icons', '@ant-design/x'],
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
    styleProps: ['style'],
    themeIntegration: { css: 'src/shared/styles/vendor', js: ['src/shared/theme/antdTheme.ts'] },
    policy: {
      componentLadder: ['antd', '@ant-design/x', 'shared/components/ui', '一次性内联'],
      overrideLadder: ['theme.components', 'vendor/antd-vars.css', '作用域变量', 'CSS Module', 'inline style'],
    },
    examples: {
      vendorSelectors: { hit: ['.ant-btn', '.ant-table-cell'], miss: ['.my-card', '.sh-panel'] },
      vendorVars: { hit: ['--ant-color-primary'], miss: ['--sh-alias-brand-primary'] },
    },
  })
}
