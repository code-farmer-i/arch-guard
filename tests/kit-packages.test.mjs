import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { coreRules, runGuard } from '../es/index.js'
import { kitFingerprints } from '../es/data/kit-fingerprints.js'
import { antdKit } from '../es/index.js'

/**
 * 适配表 `packages` 的边界：**「你必须装的」≠「这套库的全部包」**。
 *
 * 背景：`@ant-design/x` 曾经列在 `antdKit().packages` 里 —— 于是 P04 正向要求**每个** antd 项目
 * 都装上它（哪怕一行都不用）；`allow` 已开启的项目还要多抄一行。
 *
 * 删掉它之后必须同时钉住三件事：
 *   ① 不装它 → 不再被要求（本来就没用它）；
 *   ② 装了它 → 也**不许**被判「装了适配表之外的组件库」（P04 反向按**套**判：它仍登记在 kit 指纹表的 antd 条目里）；
 *   ③ 但 `allow` 已开启时，装了什么就得自己写进 `allow`（那是项目决定，不是适配器替你决定）。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

function makeProject(dependencies, presets) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-kit-'))
  mkdirSync(join(dir, 'src/app'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'kit', private: true, type: 'module', dependencies }),
  )
  writeFileSync(join(dir, 'src/app/main.tsx'), 'export const boot = 1\n')
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, deps, uiKit, antdKit, tsPack } from '${INDEX_URL}'\n` +
      `export default { packs: [tsPack], presets: [canonical(), uiKit(antdKit())${presets}], ` +
      `overrides: { ignore: ['arch.config.mjs'] } }\n`,
  )
  return dir
}

const findingsOf = (result, rule) => result.all.filter((finding) => finding.rule === rule)

test('antdKit().packages 只列「必须装的」；可选扩展仍登记在套指纹表里', () => {
  assert.deepEqual(antdKit().packages, ['antd', '@ant-design/icons'])
  const antd = kitFingerprints.find((kit) => kit.id === 'antd')
  assert.ok(
    antd?.packages.includes('@ant-design/x'),
    '可选扩展仍属 antd 这一套 —— 否则"装了它"会被误判成混进别的组件库',
  )
})

test('装了同套的可选扩展：P04 不报（按套判，不按包判）', async () => {
  const dir = makeProject(
    { antd: '^5.0.0', '@ant-design/icons': '^6.0.0', '@ant-design/x': '^2.0.0' },
    '',
  )
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.deepEqual(findingsOf(result, 'P04'), [], '@ant-design/x 不是"别的组件库"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('没装可选扩展：不再被 P04 要求安装', async () => {
  const dir = makeProject({ antd: '^5.0.0', '@ant-design/icons': '^6.0.0' }, '')
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    assert.deepEqual(findingsOf(result, 'P04'), [], '不装 @ant-design/x 不再是违规')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('allow 已开启时：同套的可选扩展要自己登记（P01 报）', async () => {
  const dir = makeProject(
    { antd: '^5.0.0', '@ant-design/icons': '^6.0.0', '@ant-design/x': '^2.0.0' },
    `, deps({ allow: ['antd', '@ant-design/icons'] })`,
  )
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    const hits = findingsOf(result, 'P01')
    assert.equal(hits.length, 1, JSON.stringify(hits))
    assert.match(hits[0]?.text ?? '', /@ant-design\/x/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('反向没被削弱：装了**别套**的组件库照样报 P04', async () => {
  const dir = makeProject(
    { antd: '^5.0.0', '@ant-design/icons': '^6.0.0', 'element-plus': '^2.0.0' },
    '',
  )
  try {
    const result = await runGuard({ cwd: dir, rules: coreRules, quiet: true })
    const hits = findingsOf(result, 'P04')
    assert.equal(hits.length, 1, JSON.stringify(hits))
    assert.match(hits[0]?.text ?? '', /element-plus/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
