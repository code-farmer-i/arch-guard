import { antdKit, canonical, deps, uiKit } from '../../es/index.js'

/**
 * 回归夹具：**只写声明类配置**（能力表 + 组件库适配表），不写 `allow`。
 *
 * 期望：P06 照常在命中手搓指纹时开火；P01 不进入 fail-closed —— react / react-dom / antd
 * 一个都没登记也不该报。锁的是「声明了什么 ≠ 批准了什么」——见 docs/adr/0005。
 */
export default {
  presets: [
    canonical(),
    uiKit(antdKit()),
    deps({ capabilities: { datetime: 'dayjs' } }),
  ],

  overrides: { enable: ['P01', 'P06'] },
}
