import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { walk } from '../es/engine/util.js'

/**
 * `walk()` 的性能优化必须有**语义等价**证明。
 *
 * 改动前实现：`readdirSync` 只拿名字 + **每个条目一次 `statSync`**；改动后：`readdirSync(..., { withFileTypes: true })`，
 * 只有符号链接才补 stat（`Dirent.isDirectory()` 描述的是链接本身，对链接返回 false；`statSync` 是跟随的）。
 *
 * 所以这里把**旧算法原样抄一份当参照**（`referenceWalk`），在含链接 / 悬空链接 / 忽略名 / 扩展名过滤的
 * 合成树上比对：两者结果必须**逐项一致**。这比"只测几个用例"更能挡住"顺手把链接语义改了"。
 */
function referenceWalk(dir, { skip = new Set(), extensions = null } = {}) {
  const out = []
  const visit = (current) => {
    let names
    try {
      names = readdirSync(current)
    } catch {
      return
    }
    for (const name of names) {
      if (skip.has(name)) continue
      const full = join(current, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) visit(full)
      else if (!extensions || extensions.some((ext) => name.endsWith(ext))) out.push(full)
    }
  }
  visit(dir)
  return out.sort()
}

/** 合成树：普通目录 / 链接目录 / 链接文件 / 悬空链接 / 忽略名 / 不匹配扩展名 */
function makeTree() {
  const root = mkdtempSync(join(tmpdir(), 'ag-walk-'))
  mkdirSync(join(root, 'real/deep'), { recursive: true })
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'a.md'), '# a\n')
  writeFileSync(join(root, 'b.ts'), 'export const b = 1\n')
  writeFileSync(join(root, 'real/inner.md'), '# inner\n')
  writeFileSync(join(root, 'real/deep/leaf.ts'), 'export const leaf = 1\n')
  writeFileSync(join(root, 'node_modules/skipme.md'), '# skipped\n')
  writeFileSync(join(root, 'docs/linked.md'), '# linked\n')
  symlinkSync(join(root, 'real'), join(root, 'linkdir'), 'dir') // 链接目录：必须跟随
  symlinkSync(join(root, 'a.md'), join(root, 'linkfile.md')) // 链接文件：按目标类型判
  symlinkSync(join(root, 'nope.md'), join(root, 'broken.md')) // 悬空链接：整体跳过
  return root
}

const opts = { skip: new Set(['node_modules']), extensions: ['.md'] }

test('walk：与改动前的实现逐项一致（含链接目录 / 链接文件 / 悬空链接）', () => {
  const root = makeTree()
  try {
    const mine = walk(root, opts)
    const reference = referenceWalk(root, opts)
    assert.deepEqual(mine, reference, '优化不许改变语义')
    // 顺带把关键语义钉死，免得有人"简化"掉链接分支而差分测试恰好被改坏
    assert.ok(mine.includes(join(root, 'linkdir/inner.md')), '链接目录必须跟随（回归夹具）')
    assert.equal(
      mine.includes(join(root, 'linkdir/deep/leaf.ts')),
      false,
      '链接目录里被扩展名过滤掉的照旧不收（跟随 ≠ 无视过滤）',
    )
    assert.ok(mine.includes(join(root, 'linkfile.md')), '链接文件按目标类型判')
    assert.equal(
      mine.some((file) => file.includes('broken.md')),
      false,
      '悬空链接整体跳过（旧行为）',
    )
    assert.equal(
      mine.some((file) => file.includes('node_modules')),
      false,
      '忽略名不进去',
    )
    assert.equal(
      mine.some((file) => file.endsWith('.ts')),
      false,
      '扩展名过滤照旧',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('walk：不带 extensions 时收全部文件；带 extensions 时只收匹配的', () => {
  const root = makeTree()
  try {
    const all = walk(root, { skip: new Set(['node_modules']) })
    assert.ok(all.length > walk(root, opts).length, '不带扩展名过滤应当更多')
    assert.ok(all.some((file) => file.endsWith('.ts')))
    assert.ok(all.some((file) => file.endsWith('.md')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('walk：不存在的目录返回空数组（不抛）', () => {
  assert.deepEqual(walk('/definitely/not/here', opts), [])
})

test('walk：输出稳定排序（跨多次调用一致）', () => {
  const root = makeTree()
  try {
    assert.deepEqual(walk(root, opts), walk(root, opts))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
