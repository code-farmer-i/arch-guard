import { library } from '../../es/index.js'

/**
 * 运行时面与面值（R-139 / R-140，ADR-0008）：形状照抄 dsh-workbench（双运行时 dsh 插件包）。
 *
 * - 两个运行时入口：`src/app/host.ts`（宿主）与 `src/app/client.tsx`（浏览器）
 * - 面：`modules/issues/index.ts`（宿主面）+ `modules/issues/client.ts`（浏览器面）；
 *   `modules/panels` **只有宿主面** —— 不判完备性（实测的面是参差不齐的）
 * - 合规：宿主入口引宿主面 · 浏览器入口引浏览器面 · 同构模块（两个入口都可达）用任意面 · 面内部直引
 * - 违规：`app/layouts/Rightbar.tsx`（浏览器侧）引宿主面（④）·
 *   `modules/issues/index.ts` 导出了面值之外的东西（⑤）
 */
export default {
  presets: [
    library({
      src: 'src',
      entry: ['app/host.ts', 'app/client.tsx'],
      modules: {
        shared: 1,
        'modules/issues': 10,
        'modules/panels': 10,
        'app/layouts': 10,
      },
    }),
  ],
  overrides: {
    enable: ['S23'],
    structure: {
      runtimes: [
        { name: 'host', entries: ['src/app/host.ts'] },
        { name: 'client', entries: ['src/app/client.tsx'] },
      ],
      faces: [
        { pattern: 'src/modules/*/index.ts', runtime: 'host', value: '*Host' },
        { pattern: 'src/modules/*/client.ts', runtime: 'client', value: '*Client' },
      ],
    },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
