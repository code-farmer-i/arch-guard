import assert from 'node:assert/strict'
import { test } from 'node:test'

import { coreRules } from '../es/index.js'

/**
 * S45：本地 import 的具名成员必须真的被导出。
 *
 * 用**合成事实**测判据与边界（准、快）：真实用例由 `__fixtures__/missing-export`
 * 与 `__fixtures__/graph`（三处真阳性）在 `--self-test` 里覆盖。
 */

const rule = (id) => {
  const found = coreRules.find((entry) => entry.id === id)
  assert.ok(found, `规则 ${id} 不存在`)
  return found
}

const config = {
  root: '/tmp/imports',
  srcRoot: 'src',
  aliases: { '@': 'src' },
}

const context = ({ records, facts }) => ({
  config,
  records: records.map((rel) => ({ rel, kind: 'ts', role: 'module:lib', layer: 3 })),
  facts: new Map(Object.entries(facts)),
})

test('S45：导入的名字不存在就报；default 只看 isDefault（带名字的 default 不算具名导出）', () => {
  const findings = rule('S45').run(
    context({
      records: ['src/app/main.ts', 'src/shared/lib/util.ts'],
      facts: {
        'src/app/main.ts': {
          imports: [
            {
              spec: '@/shared/lib/util',
              line: 1,
              typeOnly: false,
              dynamic: false,
              names: ['nope'],
            },
            {
              spec: '@/shared/lib/util',
              line: 2,
              typeOnly: false,
              dynamic: false,
              hasDefault: true,
            },
            {
              spec: '@/shared/lib/util',
              line: 3,
              typeOnly: false,
              dynamic: false,
              names: ['helpful'],
            },
          ],
        },
        'src/shared/lib/util.ts': {
          // `export const helpful` + `export default function util()` —— 后者**不是**具名导出 `util`
          exports: [
            {
              name: 'helpful',
              kind: 'const',
              isStar: false,
              isDefault: false,
              typeOnly: false,
              line: 1,
            },
            {
              name: 'util',
              kind: 'function',
              isStar: false,
              isDefault: true,
              typeOnly: false,
              line: 2,
            },
          ],
          imports: [],
        },
      },
    }),
  )
  assert.deepEqual(
    findings.map((item) => item.line),
    [1],
    '只有第 1 行（nope）该报',
  )
})

test('S45：星号导出 / 星号导入 / 目标没有事实 / 解析不到 —— 一律不判（宁少报不误伤）', () => {
  const mk = (imported, targetExports) =>
    context({
      records: ['src/app/main.ts', 'src/shared/lib/star.ts', 'src/shared/lib/ui.module.css'],
      facts: {
        'src/app/main.ts': { imports: [imported], exports: [] },
        'src/shared/lib/star.ts': { imports: [], exports: targetExports },
      },
    })
  const starTarget = [
    { name: '*', kind: 're-export', isStar: true, isDefault: false, typeOnly: false, line: 1 },
  ]
  // ① 目标有 `export *` → 导出集未知
  assert.deepEqual(
    rule('S45').run(
      mk(
        {
          spec: '@/shared/lib/star',
          line: 1,
          typeOnly: false,
          dynamic: false,
          names: ['whatever'],
        },
        starTarget,
      ),
    ),
    [],
  )
  // ② `import * as ns` → 不判名字
  assert.deepEqual(
    rule('S45').run(
      mk({ spec: '@/shared/lib/star', line: 1, typeOnly: false, dynamic: false, star: true }, []),
    ),
    [],
  )
  // ③ 目标没有事实（CSS Module 等非 TS 文件）→ 不判
  assert.deepEqual(
    rule('S45').run(
      mk(
        {
          spec: '@/shared/lib/ui.module.css',
          line: 1,
          typeOnly: false,
          dynamic: false,
          hasDefault: true,
        },
        [],
      ),
    ),
    [],
  )
  // ④ 解析不到（第三方包 / 别名外）→ 不判
  assert.deepEqual(
    rule('S45').run(
      mk({ spec: 'react', line: 1, typeOnly: false, dynamic: false, names: ['useState'] }, []),
    ),
    [],
  )
})
