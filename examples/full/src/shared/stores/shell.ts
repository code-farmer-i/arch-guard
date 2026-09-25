import { useSyncExternalStore } from 'react'

interface ShellState {
  selected: string
}

let state: ShellState = { selected: '' }
const listeners = new Set<() => void>()

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): ShellState => state

/** 客户端状态的唯一落点（S41）：命名 `use*Store` + 只在 src/shared/stores/** */
export function setShellSelected(name: string): void {
  state = { selected: name }
  for (const listener of listeners) listener()
}

export function useShellStore<T>(pick: (next: ShellState) => T): T {
  return pick(useSyncExternalStore(subscribe, getSnapshot))
}
