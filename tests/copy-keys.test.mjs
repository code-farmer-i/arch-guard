import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractFacts } from '../es/engine/facts.js'
import { collectI18n } from '../es/engine/i18n.js'
import { keysExist, noDeadKeys } from '../es/packs/react/rules/copy.js'

const DIR = 'src/shared/i18n/locales'

/** 两份语言的资源：nav 有 crews（都有）/ title（只有中文）；common.theme.dark 两边都有 */
const LOCALES = {
  [`${DIR}/zh-CN/nav.ts`]: "export default {\n  crews: '数字员工',\n  title: '标题',\n}\n",
  [`${DIR}/en/nav.ts`]: "export default {\n  crews: 'Crews',\n}\n",
  [`${DIR}/zh-CN/common.ts`]: "export default {\n  theme: { dark: '暗' },\n}\n",
  [`${DIR}/en/common.ts`]: "export default {\n  theme: { dark: 'Dark' },\n}\n",
}

const i18nAdapter = { facet: 'i18n', fn: 't', hook: 'useTranslation', resourceDir: DIR }

/** 造一个够用的上下文：只填 C02 / C06 真正会读的字段（facts 用真解析器产出） */
function makeContext(files, { adapters = { i18n: i18nAdapter }, extraRecords = [] } = {}) {
  const all = { ...LOCALES, ...files }
  const facts = new Map()
  for (const [rel, text] of Object.entries(all)) {
    facts.set(rel, extractFacts({ file: rel, rel, role: 'shared:lib', text }))
  }
  const rels = Object.keys(all).map((rel) => ({ rel, kind: rel.endsWith('.css') ? 'css' : 'ts' }))
  return {
    config: { adapters },
    records: [...rels, ...extraRecords],
    facts,
    i18n: collectI18n({ records: rels, sourceOf: (rel) => all[rel], resourceDir: DIR }),
    sourceOf: (rel) => all[rel],
  }
}

const shape = (findings) =>
  findings.map((item) => `${item.rule} ${item.file}:${item.line} ${item.text}`)

test('C02：t() 的键存在就放行，拼错就报在调用行上', () => {
  const ctx = makeContext({
    'src/shared/components/ui/Page.tsx':
      "export const x = (\n  <div>{t('nav.crews')}{t('nav.typo')}</div>\n)\n",
  })
  assert.deepEqual(shape(keysExist.run(ctx)), [
    'C02 src/shared/components/ui/Page.tsx:2 文案键不存在：nav.typo',
  ])
})

test('C02：命名空间式调用、ns:key、动态键、非翻译函数都不算错', () => {
  const ctx = makeContext({
    'src/modules/a/views/A.tsx': [
      "const { t } = useTranslation('nav')",
      "export const a = t('crews')",
      "export const b = t('nav:crews')",
      'export const c = t(`nav.${name}`)',
      "export const d = other('nav.typo')",
      'export const e = t(dynamicKey)',
    ].join('\n'),
  })
  assert.deepEqual(keysExist.run(ctx), [])
})

test('C02：冒号写法的命名空间也要按 nav.<key> 校验', () => {
  const ctx = makeContext({
    'src/modules/a/views/A.tsx': "export const a = t('nav:typo')\n",
  })
  assert.deepEqual(shape(keysExist.run(ctx)), [
    'C02 src/modules/a/views/A.tsx:1 文案键不存在：nav:typo',
  ])
})

test('C02：useTranslation("translation") 是 i18next 默认命名空间，不参与拼前缀', () => {
  const ctx = makeContext({
    'src/modules/a/views/A.tsx':
      "const { t } = useTranslation('translation')\nexport const a = t('nav.crews')\n",
  })
  assert.deepEqual(keysExist.run(ctx), [])
})

test('C02：适配器只登记函数名时，允许带对象前缀的调用，且默认名字是 t', () => {
  const custom = makeContext(
    { 'src/modules/a/views/A.tsx': "export const a = i18n.translate('nav.typo')\n" },
    {
      adapters: {
        i18n: { facet: 'i18n', fn: 'translate', hook: 'useTranslation', resourceDir: DIR },
      },
    },
  )
  assert.equal(keysExist.run(custom).length, 1)

  const bare = makeContext(
    { 'src/modules/a/views/A.tsx': "export const a = t('nav.typo')\n" },
    { adapters: {} },
  )
  assert.equal(keysExist.run(bare).length, 1, '适配器没登记 fn 时按 t 兜底')
})

test('C02：资源目录自己不是调用点，未解析出事实的文件跳过；缺 i18n 索引直接空', () => {
  const ctx = makeContext({
    [`${DIR}/zh-CN/weird.ts`]: "export const z = t('nav.typo')\nexport default {}\n",
  })
  ctx.records.push({ rel: 'src/readme.md', kind: 'other' })
  assert.deepEqual(keysExist.run(ctx), [], 'locales 文件里的 t() 不算用法')

  assert.deepEqual(keysExist.run({ ...ctx, i18n: undefined }), [])
  assert.deepEqual(
    keysExist.run({ ...ctx, i18n: { resourceDir: DIR, languages: [], files: [] } }),
    [],
    '资源目录里一个分片都没有时没有可校验的键集合',
  )
})

test('C06：被 t() 引用的键不算死键，没人引用的报在定义行上', () => {
  const ctx = makeContext({
    'src/shared/components/ui/Page.tsx':
      "export const x = (\n  <div>{t('nav.crews')}{t('common.theme.dark')}</div>\n)\n",
  })
  // nav.title 只有中文有键、也没人用 → 死键；nav.crews / common.theme.dark 都被引用 → 放行
  assert.deepEqual(shape(noDeadKeys.run(ctx)), [
    'C06 src/shared/i18n/locales/zh-CN/nav.ts:3 死键：nav.title',
  ])
})

/** 单语言、单个分片的索引：让 C06 的断言能精确到某一条键 */
const singleLangIndex = (keys) => ({
  resourceDir: DIR,
  languages: ['zh-CN'],
  files: [
    { rel: `${DIR}/zh-CN/nav.ts`, language: 'zh-CN', namespace: 'nav', isEntry: false, keys },
  ],
})

test('C06：间接引用（常量表里的键字面量）与动态前缀都算「被用过」', () => {
  const indirect = makeContext({
    'src/shared/theme/themeModes.ts': "export const MODES = [{ labelKey: 'nav.title' }]\n",
  })
  indirect.i18n = singleLangIndex([
    { path: 'nav.title', line: 2 },
    { path: 'nav.crews', line: 3 },
  ])
  assert.deepEqual(
    shape(noDeadKeys.run(indirect)),
    ['C06 src/shared/i18n/locales/zh-CN/nav.ts:3 死键：nav.crews'],
    'labelKey 这类常量表引用要兜住（不做绑定解析），但同命名空间里没人引用的键照样报',
  )

  const dynamic = makeContext({
    'src/modules/a/views/A.tsx': 'export const pick = (name: string) => t(`nav.${name}`)\n',
  })
  dynamic.i18n = singleLangIndex([
    { path: 'nav.crews', line: 2 },
    { path: 'common.save', line: 3 },
  ])
  assert.deepEqual(
    shape(noDeadKeys.run(dynamic)),
    ['C06 src/shared/i18n/locales/zh-CN/nav.ts:3 死键：common.save'],
    '模板串只放行它自己的前缀，别的前缀不受影响',
  )
})

test('C06：聚合入口的键没有语义；没有可校验的索引时直接空', () => {
  const ctx = makeContext({})
  ctx.i18n = {
    resourceDir: DIR,
    languages: ['zh-CN'],
    files: [
      {
        rel: `${DIR}/zh-CN/index.ts`,
        language: 'zh-CN',
        namespace: 'index',
        isEntry: true,
        keys: [{ path: 'index.bogus', line: 1 }],
      },
    ],
  }
  assert.deepEqual(noDeadKeys.run(ctx), [])

  assert.deepEqual(noDeadKeys.run({ ...ctx, i18n: undefined }), [])
  assert.deepEqual(
    noDeadKeys.run({ ...ctx, i18n: { resourceDir: DIR, languages: [], files: [] } }),
    [],
  )
})
