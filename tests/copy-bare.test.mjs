import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/** C01 裸文案的三种形态：JSX 文本 / 面向用户的属性 / 声明了的组件库调用（直接实参与对象实参） */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const context = ({ params, rel, facts }) => ({
  config: { params, structure: {} },
  records: [{ rel, kind: 'tsx', layer: 3, role: 'module:views' }],
  facts: new Map([[rel, { comments: [], exports: [], functions: [], hasJsx: true, ...facts }]]),
  files: [rel],
  i18n: { resourceDir: 'src/shared/i18n/locales' },
})

test('C01：组件库调用的两种形态都判（直接实参 / 对象实参，且对象形态要属性名在清单里）', () => {
  const rel = 'src/modules/crews/views/CrewsPage.tsx'
  const params = {
    messageApis: ['message.success', 'notification.open'],
    messageProps: ['message'],
  }
  const findings = rule('C01').run(
    context({
      params,
      rel,
      facts: {
        calls: [
          { callee: 'message.success', line: 2, stringArg: '保存成功' },
          { callee: 'notification.open', line: 3 },
        ],
        strings: [
          {
            value: '保存失败',
            line: 3,
            context: 'object',
            prop: 'message',
            inCall: 'notification.open',
          },
          {
            value: 'crews-save',
            line: 3,
            context: 'object',
            prop: 'key',
            inCall: 'notification.open',
          },
        ],
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.text),
    ['裸文案：message.success("保存成功")', '裸文案：notification.open({ message: "保存失败" })'],
    'key 不是文案属性 → 不报；没在清单里的属性也不报',
  )
})

test('C01：没声明 messageProps 时对象形态不判（宁少报不误伤）', () => {
  const rel = 'src/modules/crews/views/CrewsPage.tsx'
  const findings = rule('C01').run(
    context({
      params: { messageApis: ['notification.open'] },
      rel,
      facts: {
        calls: [],
        strings: [
          {
            value: '保存失败',
            line: 3,
            context: 'object',
            prop: 'message',
            inCall: 'notification.open',
          },
        ],
      },
    }),
  )
  assert.deepEqual(findings, [])
})
