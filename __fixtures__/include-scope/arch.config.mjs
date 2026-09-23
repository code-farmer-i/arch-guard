import { canonical, hygiene } from '../../es/index.js'

// 契约扫描域夹具：canonical() 默认 include = src/**，
// 域外的 vite.config.ts / scripts/gen.ts 不该被报「不在目录契约内」，
// 但 tests/ 仍要能把 src 里的文件接成可达（防假孤儿）。
export default {
  presets: [canonical(), hygiene()],
}
