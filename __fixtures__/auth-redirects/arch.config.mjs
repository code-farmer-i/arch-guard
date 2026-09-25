import { canonical } from '../../es/index.js'

/**
 * 场景：`app/guards/RequireAuth.tsx` 里写了"未登录跳登录"（合规），
 * 但两个页面又各写了一遍 —— 调用形态 `navigate('/login')` 与 JSX 形态 `<Navigate to="/login" />`（各违规一条）。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S42'],
    structure: { authRedirects: { loginPaths: ['/login'], in: ['src/app/guards/**'] } },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
