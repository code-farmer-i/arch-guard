/**
 * 唯一的输出出口：门禁自身也守「真相唯一」——
 * 全项目只在这里出现 console（eslint 对其它文件禁 console）。
 */

export function out(line = ''): void {
  console.log(line)
}

export function err(line = ''): void {
  console.error(line)
}

export function json(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}
