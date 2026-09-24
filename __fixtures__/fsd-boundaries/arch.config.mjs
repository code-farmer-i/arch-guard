import { fsd } from '../../es/index.js'

// 边界夹具：这五种形态过去会被误报（或漏报），现在按社区文件系统模型对齐 ——
// 整个树一条都不该报（`exact: true` 同时验证"合规不报"与"没有多余命中"）。
//   ① 单文件片段 `entities/crew/model.ts`（社区按去掉扩展名的名字认片段）
//   ② `shared/api/index.js`：入口认代码扩展名
//   ③ `shared/ui/index.ts` + `button/` 无 index：片段根有入口 → 跳过子目录检查
//   ④ `shared/i18n/index.ts`：shared 的每个片段都要公开面（不是只算常规 5 个）
//   ⑤ `shared/lib/format/index.ts`：一级子目录各有入口（lib 的另一半）
export default {
  presets: [fsd()],
}
