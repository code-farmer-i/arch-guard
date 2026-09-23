import { defineConfig } from '@pagoda-cli/core'

export default defineConfig({
  name: 'arch-guard',
  build: {
    // 纯 TS 库（CLI 工具）：只编译源码，不做组件扫描
    mode: 'lib',
    // 保留模块结构：本包有多入口与子路径导出（presets / packs / data）
    bundle: false,
    // 目标平台是 Node，不是浏览器
    platform: 'node',
    umd: false,
    // 不生成 sourcemap：esbuild 会把开发机绝对路径写进 .js.map，进而进入发布产物
    sourcemap: false,
    packageManager: 'pnpm',
    extensions: {
      // 产物用 .js（package.json 已声明 "type": "module"）：
      // TS 的 nodenext 只把 `./x.js` 映射回 `./x.ts`，而 `.mjs` 只映射 `.mts`。
      esm: '.js',
      cjs: '.cjs',
    },
    esbuildOptions: {
      target: 'es2022',
    },
  },
})
