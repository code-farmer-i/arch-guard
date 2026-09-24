// @ts-expect-error 演示类型逃生舱注释
const loose = 1

// eslint-disable-next-line
export function risky(input?: { value?: string }): string {
  const v = input!.value!
  debugger
  alert('boom')
  try {
    return v
  } catch {}
}

export const PLACEHOLDER = '暂未实现'
