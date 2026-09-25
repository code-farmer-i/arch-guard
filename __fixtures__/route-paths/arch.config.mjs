import { canonical, reactRouterKit, router } from '../../es/index.js'

/**
 * 路由路径的**唯一出处**：D23 只认 `pathSource` 声明的那个文件里的路径字面量。
 *
 * - `src/shared/config/paths.ts` 里的 `/crews` / `/orders` 合规（那就是唯一出处）
 * - `src/app/router/index.ts` 的 `{ path: '/crews' }`、`navigate('/crews')` 违规
 * - `src/shared/components/ui/Nav.tsx` 的 `<Link to="/orders">` 违规
 * - 同一批文件里引用 `PATHS.*` 的写法一律合规
 */
export default {
  presets: [
    canonical(),
    router(reactRouterKit({ pathSource: 'src/shared/config/paths.ts' })),
  ],
  overrides: {
    enable: ['D23'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
