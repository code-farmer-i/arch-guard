import assert from 'node:assert/strict'
import { test } from 'node:test'

import { collectI18n, parseLocaleFile } from '../es/engine/i18n.js'

const DIR = 'src/shared/i18n/locales'

test('i18n：命名空间前缀、嵌套键路径、入口文件不产键', () => {
  const nav = parseLocaleFile(
    `${DIR}/zh-CN/nav.ts`,
    "export default {\n  crews: '数字员工',\n  detail: { title: '标题' },\n}\n",
    DIR,
  )
  assert.equal(nav?.language, 'zh-CN')
  assert.equal(nav?.namespace, 'nav')
  assert.equal(nav?.isEntry, false)
  assert.deepEqual(
    nav?.keys.map((key) => [key.path, key.line]),
    [
      ['nav.crews', 2],
      ['nav.detail.title', 3],
    ],
  )

  // 聚合入口只是把分片拼起来，它自己的键没有语义
  const entry = parseLocaleFile(
    `${DIR}/zh-CN/index.ts`,
    "import nav from './nav'\nexport default { nav }\n",
    DIR,
  )
  assert.equal(entry?.isEntry, true)
  assert.deepEqual(entry?.keys, [])
})

test('i18n：非资源文件、没有默认导出对象、层级不对的都返回 null', () => {
  assert.equal(parseLocaleFile('src/app/main.tsx', 'export default {}', DIR), null)
  assert.equal(
    parseLocaleFile(`${DIR}/zh-CN/nav.ts`, 'export const nav = {}', DIR),
    null,
    '没有默认导出',
  )
  assert.equal(parseLocaleFile(`${DIR}/zh-CN.ts`, 'export default {}', DIR), null, '路径层级不对')
})

test('i18n：collectI18n 只收资源目录下的 ts，语言集去重排序', () => {
  const files = {
    [`${DIR}/zh-CN/nav.ts`]: "export default { crews: '员工' }",
    [`${DIR}/en/nav.ts`]: "export default { crews: 'Crews' }",
    [`${DIR}/en/common.ts`]: "export default { save: 'Save' }",
    'src/app/main.tsx': 'export const x = 1',
  }
  const index = collectI18n({
    records: Object.keys(files).map((rel) => ({ rel, kind: 'ts' })),
    sourceOf: (rel) => files[rel],
    resourceDir: DIR,
  })
  assert.deepEqual(index.languages, ['en', 'zh-CN'])
  assert.equal(index.files.length, 3)
  assert.equal(
    index.files.find((file) => file.rel.endsWith('en/common.ts'))?.keys[0]?.path,
    'common.save',
  )
})
