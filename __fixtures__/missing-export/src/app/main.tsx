// 违规：util.ts 导的是 helpful，没有 Good
import { Good } from '../shared/lib/util'
// 合规：默认导出对得上
import util from '../shared/lib/util'
// 合规：星号导入不判名字
import * as utilNs from '../shared/lib/util'
// 合规：CSS Module（非 TS 目标，没有事实可判）
import styles from '../shared/ui/Box.module.css'
// 合规：目标有 `export *` → 导出集未知（S45 跳过）
import { inner } from '../shared/api'

export const probe = [Good, util, utilNs, styles, inner]
