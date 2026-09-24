import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { runGuard } from '../es/index.js'

/**
 * vendor 边界的两条回归（都是「用 FSD + antd 配置」时才暴露的缺陷）：
 *
 * 1. **D10 原先只查选择器**：DESIGN §5.2 写的是「选择器前缀**与变量前缀**只许出现在 `styles/vendor/**`」，
 *    但实现只遍历 `file.selectors` —— 于是 `--ant-*` 变量可以在 vendor 之外随便用（假绿）。
 * 2. **P11 把 vendor 前缀当成整份文件文本去 test**：适配器写的是 `vendorVars: ['^--ant-']`，
 *    `^` 的本意是"变量名开头"，没有 `m` 标志时却变成"文件开头" —— 变量不在第一行就检测不到，
 *    只用 CSS 变量（不 import antd）的项目被误报「适配表声明的库必须真的被用」。
 *
 * 现在两者共用 `design-shared.ts` 的 `vendorPatterns` / `usesVendorPatterns`：编译一份、匹配结构化结果。
 */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const INDEX_URL = pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href

const VENDOR_CSS = ':root {\n  --ant-color-primary: var(--sh-static-brand-500);\n}\n'

/** 最小宿主：canonical + 设计系统落点 + antd 适配器，只启用 D10 / D10b / P11 */
function makeProject({ vendorCss = VENDOR_CSS, cardCss }) {
  const dir = mkdtempSync(join(tmpdir(), 'ag-vendor-'))
  mkdirSync(join(dir, 'src/shared/components/ui'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/styles/vendor'), { recursive: true })
  mkdirSync(join(dir, 'src/shared/lib'), { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'vendor',
      private: true,
      type: 'module',
      dependencies: { antd: '^5.0.0', '@ant-design/icons': '^6.0.0', '@ant-design/x': '^2.0.0' },
    }),
  )
  writeFileSync(
    join(dir, 'arch.config.mjs'),
    `import { canonical, designSystem, uiKit, antdKit, reactPack } from '${INDEX_URL}'\n` +
      `export default { packs: [reactPack], presets: [canonical(), designSystem(), uiKit(antdKit())], ` +
      `overrides: { enable: ['D10', 'D10b', 'P11'], ignore: ['arch.config.mjs'] } }\n`,
  )
  if (vendorCss !== null)
    writeFileSync(join(dir, 'src/shared/styles/vendor/antd-vars.css'), vendorCss)
  if (cardCss !== undefined) {
    writeFileSync(join(dir, 'src/shared/components/ui/Card.module.css'), cardCss)
  }
  writeFileSync(join(dir, 'src/shared/lib/util.ts'), 'export const noop = (): void => undefined\n')
  return dir
}

const run = (dir) => runGuard({ cwd: dir, quiet: true })

test('D10：组件库变量出现在 vendor 之外 —— 定义与引用都要报', async () => {
  const dir = makeProject({
    cardCss: '.card {\n  --ant-local: red;\n  color: var(--ant-color-primary);\n}\n',
  })
  try {
    const result = await run(dir)
    const found = result.all.filter((finding) => finding.rule === 'D10')
    assert.equal(found.length, 2, '定义（--ant-local）与引用（var(--ant-color-primary)）各一条')
    assert.ok(found.every((finding) => finding.file === 'src/shared/components/ui/Card.module.css'))
    assert.ok(found.some((finding) => finding.text.includes('--ant-local')))
    assert.ok(found.some((finding) => finding.text.includes('var(--ant-color-primary)')))
    assert.equal(result.exitCode, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('D10：vendor 目录里的组件库变量不算越界（合法落点零噪音）', async () => {
  const dir = makeProject({ cardCss: '.card {\n  color: var(--alias-brand);\n}\n' })
  try {
    const result = await run(dir)
    assert.deepEqual(
      result.all.filter((finding) => finding.rule === 'D10').map((finding) => finding.file),
      [],
      '变量写在 vendor/ 里是它的正当落点',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('P11：只有 CSS 用到组件库变量（且不在文件第一行）不算「零使用」', async () => {
  const dir = makeProject({ cardCss: '.card {\n  color: var(--ant-color-primary);\n}\n' })
  try {
    const result = await run(dir)
    assert.equal(
      result.all.some((finding) => finding.rule === 'P11'),
      false,
      'vendor 变量在第 2 行 —— 用整份文件文本匹配 `^--ant-` 会漏判，这里必须认出来',
    )
    // 同一条 CSS 里 D10 照常报：说明 P11 认出了"在用组件库"，而 D10 仍守住落点
    assert.ok(result.all.some((finding) => finding.rule === 'D10'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('P11：真的零使用时仍然报（修复不能把这条看门狗弄哑）', async () => {
  const dir = makeProject({ vendorCss: null, cardCss: '.card {\n  color: rebeccapurple;\n}\n' })
  try {
    const result = await run(dir)
    const p11 = result.all.find((finding) => finding.rule === 'P11')
    assert.ok(p11, '既没 import 声明的包、也没有任何 vendor 选择器/变量 → 必须 warn')
    assert.equal(p11.file, 'package.json')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
