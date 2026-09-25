// 合规：测试里 mock storage 是正常用法，豁免
export function resetStorage(): void {
  localStorage.clear()
}
