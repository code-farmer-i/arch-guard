export type Thing = { id: string }

export function computeThing(id: string): string {
  return id.toUpperCase()
}
