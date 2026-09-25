import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pushCopyListNotice, pushDeclarationNotices } from '../es/engine/notices.js'

/** M1：声明配了却 0 命中 → 必须自述（不然那条纪律是空的，报告还显示通过） */

const config = (structure = {}) => ({
  structure: {
    isolate: [],
    publicApi: [],
    segmentedGroups: [],
    repetitiveNaming: [],
    importLocality: [],
    groupCountLimits: [],
    groupInDegree: [],
    nameCollisions: [],
    pluralConsistency: [],
    couplingLimits: [],
    migrating: [],
    clientState: [],
    authRedirects: undefined,
    ...structure,
  },
})

const configFull = ({ adapters = {}, params = {}, structure = {} } = {}) => ({
  ...config(structure),
  adapters,
  params,
})

const noticeOf = (structure, records, files) => {
  const notices = []
  pushDeclarationNotices(config(structure), records, files, notices)
  return notices.find((item) => item.code === 'declaration-no-match')
}

const noticeOfFull = (options, records, files, facts = new Map()) => {
  const notices = []
  pushDeclarationNotices(configFull(options), records, files, notices, facts)
  return notices.find((item) => item.code === 'declaration-no-match')
}

test('声明 0 命中：glob 没命中文件 / 维度没有任何记录 → 自述出来', () => {
  const notice = noticeOf(
    {
      migrating: ['src/legacy/**'],
      clientState: [{ naming: 'use*Store', in: ['src/modules/*/stores/**'] }],
      isolate: ['slice'],
    },
    [{ rel: 'src/modules/crews/routes.tsx', captures: { domain: 'crews' } }],
    ['src/modules/crews/routes.tsx'],
  )
  assert.ok(notice, '应当有一条 declaration-no-match')
  assert.match(notice.text, /migrating 的 src\/legacy\/\*\*/)
  assert.match(notice.text, /clientState\.in/)
  assert.match(notice.text, /维度 slice/)
})

test('声明真的命中了 → 不自述（宁少报不误伤）', () => {
  const notice = noticeOf(
    { migrating: ['src/legacy/**'], isolate: ['domain'] },
    [
      { rel: 'src/modules/crews/routes.tsx', captures: { domain: 'crews' } },
      { rel: 'src/modules/orders/routes.tsx', captures: { domain: 'orders' } },
    ],
    ['src/modules/crews/routes.tsx', 'src/modules/orders/routes.tsx', 'src/legacy/pricing.ts'],
  )
  assert.equal(notice, undefined)
})

/**
 * R-86：**方案面的声明**也要自述 —— 以前只有 `structure.*` 这一侧管（M1），面预设那侧
 * 名字多打一个字母 = 零覆盖，而报告还写着"生效的适配器：analytics=declared"。
 */
test('方案面声明 0 命中：落点不存在 / 清单没有任何命中 → 一起点名', () => {
  const notice = noticeOfFull(
    {
      adapters: {
        'call-sites': {
          facet: 'call-sites',
          id: 'declared',
          groups: [{ name: 'flag', apis: ['isEnableX'], in: ['src/shared/lib/flags.ts'] }],
        },
        'env-reads': {
          facet: 'env-reads',
          id: 'declared',
          apis: ['import.meta.env'],
          in: ['src/shared/config/**'],
        },
        analytics: {
          facet: 'analytics',
          id: 'declared',
          apis: ['trackX'],
          eventSource: 'src/shared/lib/events.ts',
        },
        router: { facet: 'router', id: 'declared', pathSource: 'src/shared/config/paths.ts' },
      },
      params: {
        numberHomes: [{ name: '请求策略', names: ['staleTime'], in: ['src/shared/config/**'] }],
      },
    },
    [{ rel: 'src/modules/crews/hooks/useCrews.ts' }],
    ['src/modules/crews/hooks/useCrews.ts'],
    new Map([
      ['src/modules/crews/hooks/useCrews.ts', { calls: [{ callee: 'track', line: 1 }], reads: [] }],
    ]),
  )
  assert.ok(notice)
  assert.match(notice.text, /有 9 条声明 0 命中/)
  assert.match(notice.text, /call-sites\[flag\]\.apis 的调用名 isEnableX/)
  assert.match(notice.text, /env-reads\.apis 的读取根 import\.meta\.env/)
  assert.match(notice.text, /还有 4 条/)
})

test('方案面声明命中时不自述：调用名 / 落点 / 环境读取根都算命中', () => {
  const notice = noticeOfFull(
    {
      adapters: {
        'call-sites': {
          facet: 'call-sites',
          id: 'declared',
          groups: [{ name: 'flag', apis: ['track'], in: ['src/**'] }],
        },
        'env-reads': {
          facet: 'env-reads',
          id: 'declared',
          apis: ['import.meta.env'],
          in: ['src/**'],
        },
        analytics: {
          facet: 'analytics',
          id: 'declared',
          apis: ['track'],
          eventSource: 'src/shared/lib/events.ts',
        },
        router: { facet: 'router', id: 'declared', pathSource: 'src/shared/config/paths.ts' },
      },
      params: { numberHomes: [{ name: '请求策略', names: ['staleTime'], in: ['src/**'] }] },
    },
    [{ rel: 'src/modules/crews/hooks/useCrews.ts' }],
    [
      'src/modules/crews/hooks/useCrews.ts',
      'src/shared/lib/events.ts',
      'src/shared/config/paths.ts',
    ],
    new Map([
      [
        'src/modules/crews/hooks/useCrews.ts',
        {
          calls: [{ callee: 'analytics.track', line: 1 }],
          reads: [{ name: 'import.meta.env.VITE_X', line: 2 }],
          numbers: [{ value: 1, raw: '1', name: 'staleTime', line: 3 }],
        },
      ],
    ]),
  )
  assert.equal(notice, undefined, '方法后缀（analytics.track）也算命中，别误报')
})

/** R-89：C01 的文案位名单取自哪里，必须自述（换库会让那一半静默关掉） */

const copyNotice = (config, enabled = ['C01']) => {
  const notices = []
  pushCopyListNotice(config, { enabled: enabled.map((id) => ({ id })) }, notices)
  return notices
}

test('R-89：名单来源三种取值互相不可混淆（项目声明 / 适配器默认 / 无）', () => {
  const kit = {
    'ui-kit': {
      facet: 'ui-kit',
      id: 'antd',
      packages: ['antd'],
      messageApis: ['message.success', 'notification.open'],
    },
  }

  assert.deepEqual(
    copyNotice(configFull({ adapters: kit, params: {} })).map((item) => item.text),
    ['C01 的文案位名单：uiKit(antd) 默认 2 条'],
  )
  assert.deepEqual(
    copyNotice(configFull({ adapters: kit, params: { messageApis: ['appToast.success'] } })).map(
      (item) => item.text,
    ),
    ['C01 的文案位名单：`copy({ messageApis })` 项目声明 1 条（覆盖 uiKit(antd) 默认 2 条）'],
  )
  assert.deepEqual(
    copyNotice(configFull({ adapters: kit, params: { messageApis: [] } })).map((item) => item.text),
    ['C01 的文案位名单：`copy({ messageApis: [] })` —— 显式关掉「组件库调用里的文案」这一半'],
  )
  const none = copyNotice(configFull({ adapters: {}, params: {} }))
  assert.equal(none.length, 1)
  assert.match(none[0].text, /^C01 的文案位名单：无 ——/)
  assert.match(none[0].text, /这一半没在判/)
})

test('R-89：C01 没在跑时不提名单（它为什么停用由「因能力未声明而停用」明列）', () => {
  assert.deepEqual(copyNotice(configFull({}), []), [])
  assert.deepEqual(copyNotice(configFull({}), ['C02', 'C03']), [])
})
