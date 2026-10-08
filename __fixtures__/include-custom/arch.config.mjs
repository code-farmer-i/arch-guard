import { canonical, hygiene } from '../../es/index.js'

/**
 * 把 scripts 也纳入契约 —— 但**用字符类**写（R-149）：
 * 在 `scripts` 前缀后面接 `[a-z]*.ts`，命中 `gen.ts`（→ 无角色 → S01，正是 include 的旋钮效果），
 * 而 `Gen.ts` 落在字符类之外（→ 域外，不判契约）。
 *
 * 手搓的 glob 编译器不支持方括号字符类，会把它转义成**字面量** —— 于是这里一个文件都匹配不上、
 * S01 静默消失，报告只会多一句"域外 2 个文件不判契约"。这条夹具就是那个假绿的回归锁。
 */
export default {
  presets: [canonical(), hygiene()],
  overrides: { include: ['src/**', 'scripts/**/[a-z]*.ts'] },
}
