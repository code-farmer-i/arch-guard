import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/** C01 裸文案的三种形态：JSX 文本 / 面向用户的属性 / 声明了的组件库调用（直接实参与对象实参） */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const context = ({ params, rel, facts, adapters = {} }) => ({
  config: { params, structure: {}, adapters },
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

/* ---------------- 名单来自哪里：项目 或 组件库适配器 ---------------- */

const KIT = {
  'ui-kit': {
    facet: 'ui-kit',
    id: 'antd',
    packages: ['antd'],
    messageApis: ['message.success', 'notification.open'],
    messageProps: ['message', 'description'],
  },
}

const bareCallFacts = {
  calls: [{ callee: 'message.success', line: 2, stringArg: '保存成功' }],
  strings: [],
}

test('C01：项目没声明名单时，用**组件库适配器**给的默认（不必每个宿主抄一遍）', () => {
  const findings = rule('C01').run(
    context({
      params: {},
      adapters: KIT,
      rel: 'src/modules/crews/lib/notify.ts',
      facts: bareCallFacts,
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.rule),
    ['C01'],
    'antdKit 声明了 message.success 是文案位 → 项目不写 copy({...}) 也该判',
  )
})

test('C01：项目声明**覆盖**适配器默认（自己的封装说了算）', () => {
  const findings = rule('C01').run(
    context({
      params: { messageApis: ['appToast.success'], messageProps: ['message'] },
      adapters: KIT,
      rel: 'src/modules/crews/lib/notify.ts',
      facts: {
        calls: [
          { callee: 'message.success', line: 2, stringArg: '保存成功' },
          { callee: 'appToast.success', line: 3, stringArg: '保存成功' },
        ],
        strings: [],
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.line),
    [3],
    '项目声明了就只认项目那份：antd 的 message.success 不再算（比如那只是开发者提示）',
  )
})

test('C01：显式传空数组 = 关掉这一半（不是"没声明"）', () => {
  const findings = rule('C01').run(
    context({
      params: { messageApis: [], messageProps: [] },
      adapters: KIT,
      rel: 'src/modules/crews/lib/notify.ts',
      facts: bareCallFacts,
    }),
  )
  assert.deepEqual(findings, [])
})
