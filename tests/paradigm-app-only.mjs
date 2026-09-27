/**
 * **应用专属**（范式不适用）的规则清单 —— 唯一的定义处（由 `paradigm-coverage` 与 `examples` 两个测试共用）。
 *
 * 它们只在带"装配层 / 域 / 路由 / 槽位"的应用范式（`canonical()`）下成立：库与 FSD 没有这些概念。
 * R-87 时代这批规则是"静默缺席"（既不跑、也不在任何清单里）；R-142 之后它们必须**明列未启用**
 * （`skipped[].code === 'not-enabled'`）—— 名单本身没变，变的是"缺席必须说得出来"。
 */
export const APP_ONLY = [
  'S03', // 域根只许公开面入口
  'S04', // 域内 / 域外引用形态（别名约定）
  'S05', // 域外只许引 routes
  'S06', // views 对域外私有
  'S09', // app/layouts 不得 import modules
  'S14', // 域有 views 就必须有 routes
  'S15', // 可达性（域 routes 必被 app/router 聚合）
  'S18', // shared 只被一个域使用 → 下沉
  'S19', // 单文件导出值上限（应用侧的体积卫生；库的模块就是 API 面）
]
