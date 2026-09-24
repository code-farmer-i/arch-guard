import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { run } from '../es/cli.js'
import { coreRules, createRegistry, loadConfig, runGuard } from '../es/index.js'

/**
 * **范式 × 规则的一致性**：规则不能"注册了却永远判不出东西"，`--explain` 也不能承诺没在跑的事。
 *
 * 这一组来自一次真实反馈，五条全是同一类病：**声明了却不生效**（本仓最忌讳的形态）。
 *   ① `placementHint` 只看 `layout` → FSD 掉进库分支，给出「先在 `library({ modules })` 里补上」；
 *   ② S12 / S13 全靠 `record.slot` 与 canonical 专属 role 字面量 → `fsd()` 下 100% 空转；
 *   ③ `thresholds.viewLines` 只看 `slot === 'views'` → FSD 的 `pages/<切片>/ui` 静默用 `fileLines`；
 *   ④ `naming` 只有 S12/S13 在消费 → 上面两条死了，`--explain` 却照样打印命名契约；
 *   ⑤ D16 只豁免 `styleDir` → 官方 `app/styles` 片段里的全局 CSS 被误报成「出现在组件目录」。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

async function runCli(args, cwd) {
  const lines = []
  const originalLog = console.log
  const originalCwd = process.cwd()
  console.log = (line = '') => lines.push(String(line))
  try {
    process.chdir(cwd)
    return { code: await run(args, {}), out: lines.join('\n') }
  } finally {
    process.chdir(originalCwd)
    console.log = originalLog
  }
}

function makeProject(name, presets, overrides = '', files = {}) {
  const dir = mkdtempSync(join(tmpdir(), `ag-${name}-`))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, private: true, type: 'module' }))
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, library, fsd, designSystem, tsPack } from '${INDEX_URL}'\n` +
      `export default { packs: [tsPack], presets: [${presets}]${overrides ? `, overrides: { ${overrides} }` : ''} }\n`,
  )
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}

const tallPage = (name) =>
  [
    `export const ${name} = (): null => null\n`,
    ...Array.from({ length: 151 }, (_, i) => `export const line${i} = ${i}\n`),
  ].join('')

/* ---------------- ① --explain 的落点建议必须跟着范式 ---------------- */

test('① --explain：FSD 给 FSD 的落点，不会让用户去调 library()', async () => {
  const fsdDir = makeProject('explain-fsd', 'fsd(), designSystem()', '', {
    'src/app/index.tsx': 'export const app = 1\n',
  })
  const libDir = makeProject('explain-lib', 'library({ modules: { core: 1 } })', '', {
    'src/index.ts': 'export const run = 1\n',
  })
  try {
    const fsdOut = await runCli(['--explain', 'src/utils/x.ts'], fsdDir)
    assert.match(fsdOut.out, /FSD 六层/)
    assert.equal(/library\(\{ modules/.test(fsdOut.out), false, 'FSD 项目不该被建议去调 library()')

    const libOut = await runCli(['--explain', 'src/utils/x.ts'], libDir)
    assert.match(libOut.out, /library\(\{ modules \}\)/, '库范式仍然给库的建议')
  } finally {
    rmSync(fsdDir, { recursive: true, force: true })
    rmSync(libDir, { recursive: true, force: true })
  }
})

/* ---------------- ② S12 按角色后缀判（两类范式都生效）；S13 没有槽位语义就明列停用 ---------------- */

test('② S12 在 FSD 下也真的判（按角色后缀），S13 则明列停用而不是空转', async () => {
  const dir = makeProject('s12-fsd', 'fsd(), designSystem()', '', {
    'src/app/index.tsx': 'export const app = 1\n',
    'src/shared/api/BadNameProbe.ts': 'export const x = 1\n',
  })
  try {
    const { config } = await loadConfig({ root: dir })
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.ok(
      result.all.some(
        (finding) => finding.rule === 'S12' && finding.file === 'src/shared/api/BadNameProbe.ts',
      ),
      '`fsd:shared:api` 与 canonical 的 `shared:api` 语义相同，命名契约该照样判',
    )
    const registry = createRegistry(coreRules, config)
    const skipped = registry.skipped.find((item) => item.rule === 'S13')
    assert.ok(skipped, 'S13 全靠槽位语义：FSD 下必须**明列停用**（报告可见），不能空转')
    assert.match(skipped?.reason ?? '', /能力未声明/)
    assert.equal(
      registry.enabled.some((rule) => rule.id === 'S13'),
      false,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('② 对照：canonical 下 S13 照常在跑（能力由范式声明）', async () => {
  const dir = makeProject('s13-canon', 'canonical(), designSystem()', '', {
    'src/app/main.tsx': 'export const boot = 1\n',
  })
  try {
    const { config } = await loadConfig({ root: dir })
    const registry = createRegistry(coreRules, config)
    assert.ok(
      registry.enabled.some((rule) => rule.id === 'S13'),
      'canonical 声明了 structure.slots',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------- ③ viewLines 对 FSD 的页面角色生效；无页面角色时当场自述 ---------------- */

test('③ viewLines 对 FSD 的 pages/<切片>/ui 生效（不再静默退化成 fileLines）', async () => {
  const dir = makeProject(
    'viewlines-fsd',
    'fsd(), designSystem()',
    'thresholds: { viewLines: 100 }',
    {
      'src/app/index.tsx': 'export const app = 1\n',
      'src/pages/tools/index.ts': 'export { Tall } from "./ui/Tall"\n',
      'src/pages/tools/ui/Tall.tsx': tallPage('Tall'),
    },
  )
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    const hit = result.all.find((finding) => finding.rule === 'S16')
    assert.ok(hit, '页面文件超过 viewLines 必须报')
    assert.match(hit?.text ?? '', /超过上限 100/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('③ 没有页面级角色的范式配了 viewLines → 报告自述它不会生效', async () => {
  const dir = makeProject(
    'viewlines-lib',
    'library({ modules: { core: 1 } })',
    'thresholds: { viewLines: 100 }',
    {
      'src/index.ts': 'export const run = 1\n',
    },
  )
  try {
    const cli = await runCli([], dir)
    assert.match(
      cli.out,
      /阈值 viewLines=100 已设，但本范式没有页面级角色/,
      '配了却没效果必须自述（静默失效是本仓最忌讳的形态）',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------- ④ --explain 不承诺没在跑的事 ---------------- */

test('④ --explain：没有槽位语义就不打印命名契约，并说明原因', async () => {
  const fsdDir = makeProject('naming-fsd', 'fsd(), designSystem()', '', {
    'src/app/index.tsx': 'export const app = 1\n',
    'src/pages/tools/index.ts': 'export { Tall } from "./ui/Tall"\n',
    'src/pages/tools/ui/Tall.tsx': 'export const Tall = (): null => null\n',
  })
  const canonDir = makeProject('naming-canon', 'canonical(), designSystem()', '', {
    'src/app/main.tsx': 'export const boot = 1\n',
    'src/modules/tools/views/TallPage.tsx': 'export const TallPage = (): null => null\n',
  })
  try {
    const fsdOut = await runCli(['--explain', 'src/pages/tools/ui/Tall.tsx'], fsdDir)
    assert.equal(
      /命名\s+hook 前缀/.test(fsdOut.out),
      false,
      '没有 hooks/views 槽位就别打印命名契约',
    )
    assert.match(fsdOut.out, /本范式没有 views \/ hooks 槽位/)

    const canonOut = await runCli(['--explain', 'src/modules/tools/views/TallPage.tsx'], canonDir)
    assert.match(canonOut.out, /命名\s+hook 前缀/, 'canonical 有槽位语义 → 照常打印')
  } finally {
    rmSync(fsdDir, { recursive: true, force: true })
    rmSync(canonDir, { recursive: true, force: true })
  }
})

/* ---------------- ⑤ D16 与官方 app/styles 片段不再打架 ---------------- */

test('⑤ D16：官方 app/styles 片段放行；其它位置的裸 CSS 照报且文案说准', async () => {
  const dir = makeProject('d16-fsd', 'fsd(), designSystem()', '', {
    'src/app/index.tsx': 'export const app = 1\n',
    'src/app/styles/global.css': '.global {\n  color: red;\n}\n',
    'src/shared/ui/leak.css': '.leak {\n  color: red;\n}\n',
    'src/shared/ui/ok.module.css': '.ok {\n  color: red;\n}\n',
  })
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    const hits = result.all.filter((finding) => finding.rule === 'D16')
    assert.deepEqual(
      hits.map((finding) => finding.file),
      ['src/shared/ui/leak.css'],
      'app/styles 是官方全局样式片段；module.css 天然合法',
    )
    assert.match(hits[0]?.text ?? '', /全局 CSS 只许放声明的样式落点/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------- ⑥ S12 的报文要指向真正的修法（判据不动） ---------------- */

test('⑥ S12：组件目录里的非 PascalCase 文件，按**真实形态**给三种说法', async () => {
  const dir = makeProject('s12-message', 'fsd(), designSystem()', '', {
    'src/app/index.tsx': 'export const app = 1\n',
    'src/pages/tools/index.ts': 'export { P } from "./ui/P"\n',
    // ① 名字像 hook（且没有 JSX）→ 真实问题是"住错了目录"
    'src/pages/tools/ui/useThing.tsx':
      'import { useEffect } from "react"\nexport const useThing = (): void => useEffect(() => {}, [])\n',
    // ② 有 JSX 但名字不是 PascalCase → 它确实是组件，只是名字不对
    'src/shared/ui/misnamed.tsx': 'export const misnamed = () => <div />\n',
    // ③ 没有 JSX 也不是组件 → 它根本不是组件
    'src/shared/ui/lower.tsx': 'export const lower = (): number => 1\n',
    // 对照组：合规的组件
    'src/shared/ui/Pure.tsx': 'export const Pure = (): number => 1\n',
  })
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    const byFile = new Map(
      result.all
        .filter((finding) => finding.rule === 'S12')
        .map((finding) => [finding.file, finding]),
    )
    assert.equal(byFile.size, 3, `只该报这三个：${[...byFile.keys()].join(' , ')}`)
    assert.match(
      byFile.get('src/pages/tools/ui/useThing.tsx')?.text ?? '',
      /hook 不该住在组件目录.*挪到 model\/ 或 hooks\//,
      'hook 被点名时必须说"挪走"，而不是"改名字"',
    )
    assert.match(byFile.get('src/shared/ui/misnamed.tsx')?.text ?? '', /组件文件必须 PascalCase/)
    assert.match(byFile.get('src/shared/ui/lower.tsx')?.text ?? '', /不是组件却住在组件目录/)
    // 提示指修法（pretty 报告里渲染成 `→ …`）
    assert.match(
      byFile.get('src/pages/tools/ui/useThing.tsx')?.hint ?? '',
      /组件目录（ui \/ components）只放组件/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
