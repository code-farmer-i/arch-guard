import { useEffect, useState } from 'react'

export function useDebounce(value: string): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 150)
    return () => clearTimeout(timer)
  }, [value])
  return settled
}
