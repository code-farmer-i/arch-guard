import { useSyncExternalStore } from 'react'

/**
 * 客户端状态的唯一落点（S41）：命名 `use*Store` + 只在 `src/shared/stores/**`。
 *
 * 这里只放**真正跨域、且与业务域无关**的 UI 状态（语言 / 侧栏这类壳状态）。
 * 域自己的状态（筛选、向导步骤、草稿）归那个域的 `model/` —— 塞进共享 store 会让两个域
 * 争用同一个字段（谁后写谁生效），而切片/域也就失去了自治。
 */
interface ShellState {
  locale: string
}

let state: ShellState = { locale: 'zh-CN' }
const listeners = new Set<() => void>()

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): ShellState => state

export function setLocale(locale: string): void {
  state = { locale }
  for (const listener of listeners) listener()
}

export function useShellStore<T>(pick: (next: ShellState) => T): T {
  return pick(useSyncExternalStore(subscribe, getSnapshot))
}
