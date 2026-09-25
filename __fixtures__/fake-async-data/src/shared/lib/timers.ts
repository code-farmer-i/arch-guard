// 合规：只做防抖，没有包成 Promise
export function debounce(fn: () => void, wait: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(fn, wait)
  }
}
