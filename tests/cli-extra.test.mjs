import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const CLI = join(PACKAGE_ROOT, 'es/cli.js')

/** 跑 CLI 并把退出码与输出都拿回来（非零退出时 execFileSync 会抛） */
function runCli(args, cwd) {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' }),
    }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

test('cli：--verify-deps 适配表与依赖不一致时非零，并打印全表', () => {
  const result = runCli(['--verify-deps'], join(PACKAGE_ROOT, '__fixtures__/adapters'))
  assert.equal(result.code, 1)
  assert.match(result.out, /适配表 vs 实际依赖/)
  assert.match(result.out, /ui-kit|i18n/)
  assert.match(result.out, /✖ 对账失败/)
})

test('cli：--verify-deps 一致时退出 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-verify-'))
  try {
    mkdirSync(join(dir, 'src/shared/config'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'ok',
        private: true,
        type: 'module',
        dependencies: { commander: '^15.0.0' },
      }),
    )
    writeFileSync(
      join(dir, 'arch.config.mjs'),
      `import { deps } from '${pathToFileURL(join(PACKAGE_ROOT, 'es/index.js')).href}'\n` +
        "export default { overrides: { layout: { app: 'src/app', modules: 'src/modules', shared: 'src/shared' }, roles: [{ id: 'app:bootstrap', pattern: 'src/app/main.tsx', layer: 11, slot: 'bootstrap' }], params: deps({ allow: ['commander'] }).params } }\n",
    )
    writeFileSync(join(dir, 'src/app-main.tsx'), 'export const x = 1\n')
    mkdirSync(join(dir, 'src/app'), { recursive: true })
    writeFileSync(join(dir, 'src/app/main.tsx'), 'export const x = 1\n')
    const result = runCli(['--verify-deps'], dir)
    assert.equal(result.code, 0, result.out)
    assert.match(result.out, /✔ 对账通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cli：--format=github 出注解、--stats 出统计表', () => {
  const fixture = join(PACKAGE_ROOT, '__fixtures__/violations')
  const github = runCli(['--format=github'], fixture)
  assert.equal(github.code, 1)
  assert.match(
    github.out,
    /::error file=src\/modules\/crews\/views\/Bad\.tsx,line=\d+,title=S\d\d /,
  )
  assert.match(github.out, /scope=full/, '摘要仍然给人看')

  const stats = runCli(['--stats'], fixture)
  assert.match(stats.out, /合计 \d+\.\d+ms \/ \d+ 条规则/)
  assert.match(stats.out, /H01\s+hygiene/)

  const bad = runCli(['--verify-deps', '--format=xml'], fixture)
  assert.equal(bad.code, 2, '未知格式仍然退出 2')
})

test('cli：错误参数一律退出 2 并给出可用值', () => {
  const fixture = join(PACKAGE_ROOT, '__fixtures__/violations')
  for (const args of [
    ['--domain=Z'],
    ['--min-level=L9'],
    ['--severity=fatal'],
    ['--format=xml'],
    ['--config=不存在的配置.mjs'],
  ]) {
    const result = runCli(args, fixture)
    assert.equal(result.code, 2, `${args.join(' ')} 应退出 2，实际 ${result.code}`)
    assert.match(result.out, /未知|找不到/)
  }
})

test('cli：自检子命令与过滤开关', () => {
  const fixture = join(PACKAGE_ROOT, '__fixtures__/violations')
  const selfTest = runCli(['--self-test'], PACKAGE_ROOT)
  assert.equal(selfTest.code, 0, selfTest.out)
  assert.match(selfTest.out, /夹具回归通过/)

  const portability = runCli(['--self-check-portability'], PACKAGE_ROOT)
  assert.equal(portability.code, 0, portability.out)
  assert.match(portability.out, /本体自包含通过/)

  // --paths 过滤到不存在的文件 → 没有可报告的违规
  const filtered = runCli(['--paths=src/不存在的目录/**', '--format=json'], fixture)
  assert.equal(filtered.code, 0)
  assert.equal(JSON.parse(filtered.out).findings.length, 0)

  // --report-only 永远 0，即使有 error
  const advisory = runCli(['--report-only', '--format=json'], fixture)
  assert.equal(advisory.code, 0)
  assert.ok(JSON.parse(advisory.out).errors > 0, '仍然要报告出来')
})
