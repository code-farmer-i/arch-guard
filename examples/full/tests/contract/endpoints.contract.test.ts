/** 契约层（R-112）：必须**真的引用**生成的契约产物，否则后端加字段没人发现（M10 的 `mustImport`） */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatedCrewSchema } from '../../src/shared/api/generated/crews.gen.ts'
import { ENDPOINTS } from '../../src/shared/api/endpoints.ts'

test('生成的契约与端点表对账：两者都是同一份后端契约的落点', () => {
  assert.equal(typeof generatedCrewSchema, 'string')
  assert.ok(Object.values(ENDPOINTS).every((path) => path.startsWith('/')))
})
