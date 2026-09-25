import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pushDeclarationNotices } from '../es/engine/notices.js'

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

const noticeOf = (structure, records, files) => {
  const notices = []
  pushDeclarationNotices(config(structure), records, files, notices)
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
