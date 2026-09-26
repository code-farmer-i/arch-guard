import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { coreRules, runGuard } from '../es/index.js'

/**
 * `fsd()` 与**官方规范 v2.1** 的对照回归
 * （[layers](https://feature-sliced.design/docs/reference/layers) ·
 * [slices-segments](https://feature-sliced.design/docs/reference/slices-segments) ·
 * [public-api](https://feature-sliced.design/docs/reference/public-api)）。
 *
 * 这一组在意的**不是**"我们的规则对不对"，而是**官方推荐的写法在我们这儿会不会被误报**：
 *   - 官方 shared 典型段含 `routes`、app 典型段含 `routes` / `store` / `entrypoint`；
 *   - 官方 public-api 页推荐环境特定公开面 `index.server.ts` / `index.client.ts`；
 *   - 官方 `@x` 跨引用公开面**我们没实现** —— 这条**故意钉住**（行为变了必须来改这里）。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

function makeProject(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-fsdc-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fsdc', private: true, type: 'module' }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { fsd, tsPack } from '${INDEX_URL}'\nexport default { packs: [tsPack], presets: [fsd()] }\n`,
  )
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}

const run = (dir) => runGuard({ cwd: dir, rules: coreRules, quiet: true })
const pairs = (result) => result.all.map((finding) => `${finding.rule} ${finding.file}`).sort()

test('官方典型段名全部认（shared/routes · app/routes · app/store · app/entrypoint）', async () => {
  const dir = makeProject({
    'src/app/index.tsx': 'export const app = 1\n',
    'src/app/routes/index.tsx': 'export const routes = []\n',
    'src/app/store/index.ts': 'export const store = {}\n',
    'src/app/entrypoint/index.tsx': 'export const entry = 1\n',
    'src/shared/routes/index.ts': 'export const ROUTES = {}\n',
    'src/shared/lib/format.ts': 'export const format = (): string => ""\n',
  })
  try {
    const result = await run(dir)
    assert.deepEqual(
      result.all.filter((finding) => finding.rule === 'S01'),
      [],
      '官方典型段不该被判「无处安放」',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('官方环境特定公开面 index.server / index.client 算公开面', async () => {
  const dir = makeProject({
    'src/app/index.server.tsx': 'export const app = 1\n',
    'src/pages/home/index.ts': 'export { HomePage } from "./ui/HomePage"\n',
    'src/pages/home/index.server.tsx': 'export { HomePage } from "./ui/HomePage"\n',
    'src/pages/home/ui/HomePage.tsx': 'export const HomePage = (): null => null\n',
  })
  try {
    const result = await run(dir)
    assert.deepEqual(
      result.all.filter((finding) => finding.rule === 'S01' || finding.rule === 'S23'),
      [],
      'index.server.tsx 必须被认成这个切片的公开面（官方 public-api 页推荐写法）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('核心规矩照旧：同层跨切片 = S22、缺公开面 = S23、向上依赖 = S21', async () => {
  const dir = makeProject({
    'src/app/index.tsx': 'export const app = 1\n',
    'src/pages/crews/index.ts': 'export { CrewsPage } from "./ui/CrewsPage"\n',
    'src/pages/crews/ui/CrewsPage.tsx':
      "import { ReportsPage } from '../../reports/index'\nexport const CrewsPage = (): null => null\nexport const x = ReportsPage\n",
    'src/pages/reports/index.ts': 'export { ReportsPage } from "./ui/ReportsPage"\n',
    'src/pages/reports/ui/ReportsPage.tsx': 'export const ReportsPage = (): null => null\n',
    // 缺公开面的切片
    'src/pages/orphans/ui/Thing.tsx': 'export const Thing = (): null => null\n',
    // shared 反向上依赖（最低层不许引 pages）
    'src/shared/lib/leak.ts':
      "import { ReportsPage } from '../../pages/reports'\nexport const leak = ReportsPage\n",
  })
  try {
    const found = pairs(await run(dir))
    assert.ok(found.includes('S22 src/pages/crews/ui/CrewsPage.tsx'), '同层跨切片必须报')
    assert.ok(found.includes('S23 src/pages/orphans/ui/Thing.tsx'), '切片缺公开面必须报')
    assert.ok(found.includes('S21 src/shared/lib/leak.ts'), 'shared 向上依赖必须报')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('官方 `@x` 跨引用公开面：`<provider>/@x/<consumer>` 只放行被指名的那一侧（R-105）', async () => {
  const dir = makeProject({
    'src/app/index.tsx': 'export const app = 1\n',
    'src/entities/song/index.ts': 'export type { Song } from "./model/song"\n',
    'src/entities/song/model/song.ts': 'export interface Song {\n  id: string\n}\n',
    // provider 侧声明"允许 artist 拿这些"（官方的 @x 写法）
    'src/entities/song/@x/artist.ts': 'export type { Song } from "../model/song"\n',
    'src/entities/artist/index.ts': 'export type { Artist } from "./model/artist"\n',
    'src/entities/artist/model/artist.ts':
      'import type { Song } from "../../song/@x/artist"\nexport interface Artist {\n  songs: Song[]\n}\n',
    // 没被指名的切片引同一个文件 → 该报
    'src/entities/order/index.ts': 'export type { Order } from "./model/order"\n',
    'src/entities/order/model/order.ts':
      'import type { Song } from "../../song/@x/artist"\nexport interface Order {\n  song: Song\n}\n',
  })
  try {
    const found = pairs(await run(dir))
    assert.ok(
      !found.includes('S01 src/entities/song/@x/artist.ts'),
      '`@x` 目录现在有角色了 —— 不该再报「文件不在目录契约内」',
    )
    assert.ok(
      !found.some((item) => item.includes('entities/song/@x/artist.ts') && item.startsWith('S22')),
      '被指名的 artist 从 @x 取用是**合法**的跨切片通道',
    )
    assert.ok(
      found.some(
        (item) => item.startsWith('S22') && item.includes('entities/order/model/order.ts'),
      ),
      '没被指名的 order 走同一个 @x 文件 → 仍然要报（只放行被指名的那一侧）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
