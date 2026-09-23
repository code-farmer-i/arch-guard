import type { Preset, RoleDescriptor } from '../engine/types.js'

export interface LibraryOptions {
  src?: string
}

/**
 * 库 / CLI 工具范式（对比 `canonical()` 的应用范式）。
 *
 * 为什么需要它：应用的目录契约（装配 / 业务域 / 共享）对库不成立 ——
 * 库没有业务域、没有路由分片、也没有别名（内部相对导入是 Node 生态的常规写法）。
 * 强行用应用规则去量库，只会得到一堆与设计无关的报错。
 *
 * 于是「工程类型」也是一层可替换面：角色表 + 规则集一起换，引擎不动。
 */
export function libraryRoleTable(options: LibraryOptions = {}): RoleDescriptor[] {
  const src = options.src ?? 'src'
  return [
    { id: 'test', pattern: '**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}', layer: 99, exclusive: true },
    { id: 'test', pattern: '**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}', layer: 99, exclusive: true },
    { id: 'lib:entry', pattern: `${src}/{index,cli}.ts`, layer: 10, slot: 'entry' },
    { id: 'lib:engine', pattern: `${src}/engine/**`, layer: 2, slot: 'engine' },
    { id: 'lib:packs', pattern: `${src}/packs/**`, layer: 4, slot: 'packs' },
    { id: 'lib:presets', pattern: `${src}/presets/**`, layer: 4, slot: 'presets' },
    { id: 'lib:data', pattern: `${src}/data/**`, layer: 1, slot: 'data' },
  ]
}

/**
 * 库范式预设：库的角色表 + 只启用与库相关的规则。
 * `S10`（禁相对越级 / 必须走别名）是应用专属规则 —— 库没有别名约定，关掉。
 */
export function library(options: LibraryOptions = {}): Preset {
  const src = options.src ?? 'src'
  return {
    roles: libraryRoleTable({ src }),
    layout: { app: src, modules: `${src}/packs`, shared: `${src}/engine` },
    srcRoot: src,
    naming: { hookPrefix: 'use', viewSuffix: 'Page', pageComponentSuffix: 'Page' },
    thresholds: {
      fileLines: 500,
      viewLines: 500,
      functionLines: 150,
      exportsPerFile: 6,
      componentsPerFile: 3,
    },
    entries: [`${src}/index.ts`, `${src}/cli.ts`],
    ignore: [
      'arch.config.mjs',
      'arch.config.js',
      'arch.baseline.json',
      // 构建产物与宿主示例不属于本体源码树
      'es/**',
      'lib/**',
      'bin/**',
      'node_modules/**',
      '.agents/**',
      'examples/**',
      '__fixtures__/**',
      'pagoda.config.mjs',
      'eslint.config.mjs',
    ],
    enable: [
      'S00',
      'S01',
      'S02',
      'S11',
      'S12',
      'S13',
      'S16',
      'P01',
      'P02',
      'P03',
      'P06',
      'P08',
      'H01',
      'H02',
      'H03',
      'H04',
      'H05',
    ],
  }
}
