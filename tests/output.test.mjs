import assert from 'node:assert/strict'
import { test } from 'node:test'

import { err, json, out } from '../es/engine/output.js'

/** 抓取一段 stdout/stderr，避免测试里满屏打印 */
function capture(fn) {
  const logs = []
  const errors = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (line = '') => logs.push(String(line))
  console.error = (line = '') => errors.push(String(line))
  try {
    fn()
  } finally {
    console.log = originalLog
    console.error = originalError
  }
  return { stdout: logs.join('\n'), stderr: errors.join('\n') }
}

test('output：out / err / json 是唯一出口，json 输出可被解析', () => {
  const printed = capture(() => {
    out('普通一行')
    out()
    err('错误一行')
    json({ ok: true, findings: [] })
  })
  assert.match(printed.stdout, /普通一行/)
  assert.match(printed.stderr, /错误一行/)
  // json 是多行缩进输出：从第一个 '{' 开始取到结尾再解析
  const lines = printed.stdout.split('\n')
  const start = lines.findIndex((line) => line.startsWith('{'))
  assert.notEqual(start, -1, 'JSON 输出必须存在')
  assert.deepEqual(JSON.parse(lines.slice(start).join('\n')), { ok: true, findings: [] })
})
