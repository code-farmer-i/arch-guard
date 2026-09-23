import { canonical, hygiene } from '../../es/index.js'

// 把 scripts 也纳入契约：scripts/gen.ts 重新参与角色判定 → 无角色 → S01（这正是 include 的旋钮效果）
export default {
  presets: [canonical(), hygiene()],
  overrides: { include: ['src/**', 'scripts/**'] },
}
