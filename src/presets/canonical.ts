import type { Preset, RoleDescriptor } from '../engine/types.js'

export interface CanonicalOptions {
  /** 源码根，默认 src */
  src?: string
  /** 装配层：main / App / router / layouts */
  app?: string
  /** 业务域根：每个子目录是一个域 */
  modules?: string
  /** 跨域共享层 */
  shared?: string
}

/**
 * 范式约定的角色表（见 PARADIGM.md「目录契约」）。
 * 判据只用「路径」，因此判定等级是 L1；每个文件必须**恰好命中一个角色**。
 * 层号用于依赖方向（`shared` 内部是线性层序，只许向下）。
 */
export function roleTable(options: CanonicalOptions = {}): RoleDescriptor[] {
  const src = options.src ?? 'src'
  const app = options.app ?? `${src}/app`
  const modules = options.modules ?? `${src}/modules`
  const shared = options.shared ?? `${src}/shared`

  return [
    // 测试与类型声明优先占位（排他），避免和槽位角色冲突
    { id: 'test', pattern: `**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}`, layer: 99, exclusive: true },
    { id: 'test', pattern: `**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}`, layer: 99, exclusive: true },
    { id: 'test', pattern: `**/__tests__/**`, layer: 99, exclusive: true },
    { id: 'dts', pattern: `${src}/*.d.ts`, layer: 0, exclusive: true },

    // 装配层
    { id: 'app:bootstrap', pattern: `${app}/main.{ts,tsx}`, layer: 11, slot: 'bootstrap' },
    { id: 'app:bootstrap', pattern: `${app}/App.{ts,tsx}`, layer: 11, slot: 'bootstrap' },
    { id: 'app:router', pattern: `${app}/router/**`, layer: 11, slot: 'router' },
    { id: 'app:layouts', pattern: `${app}/layouts/**`, layer: 11, slot: 'layouts' },

    // 业务域：七个槽位 + 唯一入口 routes
    {
      id: 'module:routes',
      pattern: `${modules}/{domain}/routes.{ts,tsx}`,
      layer: 10,
      slot: 'routes',
    },
    { id: 'module:views', pattern: `${modules}/{domain}/views/**`, layer: 10, slot: 'views' },
    {
      id: 'module:components',
      pattern: `${modules}/{domain}/components/**`,
      layer: 10,
      slot: 'components',
    },
    { id: 'module:hooks', pattern: `${modules}/{domain}/hooks/**`, layer: 10, slot: 'hooks' },
    { id: 'module:model', pattern: `${modules}/{domain}/model/**`, layer: 10, slot: 'model' },
    { id: 'module:lib', pattern: `${modules}/{domain}/lib/**`, layer: 10, slot: 'lib' },
    { id: 'module:assets', pattern: `${modules}/{domain}/assets/**`, layer: 10, slot: 'assets' },

    // 共享层：内部线性层序（0 最低）
    { id: 'shared:styles', pattern: `${shared}/styles/**`, layer: 0, slot: 'styles' },
    { id: 'shared:assets', pattern: `${shared}/assets/**`, layer: 0, slot: 'assets' },
    { id: 'shared:lib', pattern: `${shared}/lib/**`, layer: 1, slot: 'lib' },
    { id: 'shared:config', pattern: `${shared}/config/**`, layer: 2, slot: 'config' },
    { id: 'shared:i18n', pattern: `${shared}/i18n/**`, layer: 3, slot: 'i18n' },
    { id: 'shared:api', pattern: `${shared}/api/**`, layer: 4, slot: 'api' },
    { id: 'shared:stores', pattern: `${shared}/stores/**`, layer: 5, slot: 'stores' },
    { id: 'shared:theme', pattern: `${shared}/theme/**`, layer: 6, slot: 'theme' },
    { id: 'shared:hooks', pattern: `${shared}/hooks/**`, layer: 7, slot: 'hooks' },
    { id: 'shared:components:ui', pattern: `${shared}/components/ui/**`, layer: 8, slot: 'ui' },
    {
      id: 'shared:components:common',
      pattern: `${shared}/components/common/**`,
      layer: 8,
      slot: 'common',
    },
  ]
}

/** 范式 canonical 预设：目录契约 + 命名 + 阈值 + 层序 */
export function canonical(options: CanonicalOptions = {}): Preset {
  const src = options.src ?? 'src'
  const app = options.app ?? `${src}/app`
  const modules = options.modules ?? `${src}/modules`
  const shared = options.shared ?? `${src}/shared`

  return {
    roles: roleTable({ src, app, modules, shared }),
    layout: { app, modules, shared },
    srcRoot: src,
    naming: { hookPrefix: 'use', viewSuffix: 'Page', pageComponentSuffix: 'Page' },
    thresholds: {
      fileLines: 500,
      viewLines: 500,
      functionLines: 150,
      exportsPerFile: 6,
      componentsPerFile: 3,
    },
    layers: {
      [`${shared}/styles`]: 0,
      [`${shared}/assets`]: 0,
      [`${shared}/lib`]: 1,
      [`${shared}/config`]: 2,
      [`${shared}/i18n`]: 3,
      [`${shared}/api`]: 4,
      [`${shared}/stores`]: 5,
      [`${shared}/theme`]: 6,
      [`${shared}/hooks`]: 7,
      [`${shared}/components`]: 8,
      [modules]: 10,
      [app]: 11,
    },
    entries: [`${app}/main.tsx`],
    // 门禁自身的配置文件不属于项目源码树
    ignore: ['arch.config.mjs', 'arch.config.js', 'arch.baseline.json', '.agents/**'],
  }
}
