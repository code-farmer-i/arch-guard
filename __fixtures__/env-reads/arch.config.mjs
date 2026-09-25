import { canonical, envReads } from '../../es/index.js'

/**
 * 场景：`import.meta.env.VITE_API_BASE` 在模块里直接读 —— 改名 / 换环境全仓搜，
 * 而且读到的是原始字符串（没有默认值、没有校验、没有类型）。
 * 声明落点后：配置模块里读合规；别处读报；类型声明文件（`vite-env.d.ts`）不算读取。
 */
export default {
  presets: [
    canonical(),
    envReads({ apis: ['import.meta.env', 'process.env'], in: ['src/shared/config/**'] }),
  ],
  overrides: { enable: ['S44'], ignore: ['arch.config.mjs', 'expect.json'] },
}
