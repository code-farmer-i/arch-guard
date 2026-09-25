import { canonical, hygiene } from '../../es/index.js'

/**
 * 场景：重构后旧实现留在仓库里（CrewsPage.old.tsx / useCrewsLegacy.ts）——
 * 没人敢删、新人抄了旧的那一份、两套实现行为不一致。
 *
 * 判定只认"整段"命中（标记紧挨扩展名），所以 legacy-support.ts 这种正常模块不报。
 */
export default {
  presets: [canonical(), hygiene()],
  overrides: {
    enable: ['H12'],
    ignore: ['arch.config.mjs', 'expect.json'],
  },
}
