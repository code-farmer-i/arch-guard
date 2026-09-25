// 合规：给旧环境兜底的正常模块 —— 标记不在"整段"位置，不报
export function needsLegacySupport(): boolean {
  return false
}
