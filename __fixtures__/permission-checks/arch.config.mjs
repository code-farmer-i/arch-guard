import { callSites, canonical } from '../../es/index.js'

/**
 * 场景：`permissions.includes('crews.edit')` 这种**原始权限形态**散在组件里 ——
 * 权限模型改一次要全仓找，漏一处就是越权入口。
 *
 * 用现有的调用落点声明表达（不新立规则）：把"原始形态"列进 apis、把唯一落点写进 in。
 * **高层 API（`can('crews.edit')`）不在清单里 → 到哪都合法**，这正是"哪些算合法展示判断"的答案。
 */
export default {
  presets: [
    canonical(),
    callSites([
      {
        name: '权限判断',
        apis: ['permissions.includes', 'user.hasRole'],
        in: ['src/shared/auth/**'],
      },
    ]),
  ],
  overrides: { enable: ['S38'], ignore: ['arch.config.mjs', 'expect.json'] },
}
