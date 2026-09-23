/**
 * P07 违规样例：同一个文件里两类证据同时成立 ——
 * 弱语法指纹（`setTimeout(` / `clearTimeout(`）+ 命名指纹（自研了与成熟库同名的 `debounce`）。
 * 单条弱证据不报，所以两条必须同文件出现（见 src/data/wheel-fingerprints.ts）。
 *
 * 同时它是孤儿文件（夹具里没有入口引用）→ S15。
 */
export function debounce(fn: () => void, wait: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(fn, wait)
  }
}
