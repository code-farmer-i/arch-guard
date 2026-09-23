// 测试在契约扫描域之外：不作为契约文件，但必须能作为"可达根"把 src 里的文件接上，
// 否则 src/shared/lib/thing.ts 会被误判成孤儿（S15）。
import { thing } from '../src/shared/lib/thing'

export const covered = thing
