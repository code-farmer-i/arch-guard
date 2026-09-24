export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(deepClone) as T
  if (value && typeof value === 'object') {
    return Object.assign({}, value) as T
  }
  return value
}
