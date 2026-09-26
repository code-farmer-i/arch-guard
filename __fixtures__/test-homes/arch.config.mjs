import { canonical, metrics } from '../../es/index.js'

/**
 * 测试落点契约（R-112 / M10）：每层测试声明"许从哪进 / 要对账什么"。
 *
 * - `e2e`：`imports: 'public'` —— 只许经公开面 / 应用入口（`config.entries` 里的 `src/app/main.tsx`）
 * - `contract`：`mustImport` 生成物 —— 必须真的引用它，否则契约漂移没人发现
 * - 三条判据各有一个违规样例：e2e 直引内部组件 · smoke 没对账 · visual 声明的落点一个文件都没有
 *
 * 注意 `include`：测试层得进**契约扫描域**，否则它们不在文件集里，落点会被当成空的。
 */
export default {
  presets: [
    canonical(),
    metrics({
      tests: {
        homes: [
          { name: 'e2e', glob: 'e2e/**/*.spec.ts', imports: 'public' },
          { name: 'contract', glob: 'tests/contract/**', mustImport: ['src/shared/api/generated/**'] },
          { name: 'smoke', glob: 'tests/smoke/**', mustImport: ['src/shared/api/generated/**'] },
          { name: 'visual', glob: 'tests/visual/**' },
        ],
      },
    }),
  ],
  overrides: {
    enable: ['M10'],
    include: ['src/**', 'e2e/**', 'tests/**'],
    entries: ['src/app/main.tsx'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
