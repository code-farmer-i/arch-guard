import { canonical } from '../../es/index.js'

/**
 * 场景（C10）：`canonical()` 的域就是它的**组维度** —— 声明 `importLocality: ['domain']` 后：
 * 跨域用相对路径（`../../orders/views/OrdersPage`）报；跨域走别名、同域内相对都不报。
 *
 * 这条夹具是"组维度规则在应用范式下真的生效"的证据 —— 修之前这五条规则在这里全沉默。
 */
export default {
  presets: [canonical()],
  overrides: {
    enable: ['S32'],
    structure: { importLocality: ['domain'] },
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
