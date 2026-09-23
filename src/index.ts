/**
 * arch-guard 公共 API。
 *
 * 宿主项目（写 arch.config.mjs）：
 *   import { canonical, designSystem, hygiene, uiKit, antdKit } from 'arch-guard/presets'
 * 程序化用法（CI / 工具集成）：
 *   import { runGuard } from 'arch-guard'
 */

export type * from './engine/types.js'
export { loadConfig, aliasesFromTsconfig } from './engine/config.js'
export { scanProject } from './engine/scan.js'
export { extractFacts, factInputOf, TS_EXTENSIONS } from './engine/facts.js'
export { buildGraph, resolveSpecifier } from './engine/graph.js'
export { defineAdapter, AdapterError, FACETS } from './engine/adapters.js'
export { createRegistry, hasCapability } from './engine/registry.js'
export {
  depsPolicyFrom,
  policyConflicts,
  readPackageJson,
  readProjectDeps,
  type DepsPolicy,
  type ProjectDeps,
} from './engine/deps.js'
export { createRule, RuleDefinitionError } from './engine/rule.js'
export { definePack, PackError, type Pack as PackDefinition } from './engine/pack.js'
export { auditAdapterDeps, describePolicy } from './engine/deps-audit.js'
export { CONFIG_SPEC_VERSION } from './engine/config.js'
export { BASELINE_SPEC_VERSION } from './engine/baseline.js'
export { runGuard, type RunOptions, type RunResult } from './engine/run.js'
export { checkPortability } from './engine/portability.js'
export { runSelfTest } from './engine/self-test.js'
export {
  applyBaseline,
  anchorFor,
  entriesFromFindings,
  loadBaseline,
  saveBaseline,
  type BaselineEntry,
  type BaselineFile,
  type BaselineSplit,
} from './engine/baseline.js'
export { anchorOf, globToRegExp, mergePresets, sha1 } from './engine/util.js'
export {
  summarize,
  toJsonReport,
  renderReport,
  renderSummary,
  severityOf,
} from './engine/report.js'

export { canonical, roleTable } from './presets/canonical.js'
export { library, libraryRoleTable } from './presets/library.js'
export { designSystem, deps } from './presets/design-system.js'
export { copy } from './presets/copy.js'
export { metrics } from './presets/metrics.js'
export { hygiene } from './presets/hygiene.js'
export { uiKit, antdKit, noneKit } from './presets/index.js'

export { reactPack, reactRules } from './packs/react/index.js'
export { kitFingerprints, fingerprintsOf } from './data/kit-fingerprints.js'
export {
  wheelFingerprints,
  capabilityOf,
  type WheelFingerprint,
} from './data/wheel-fingerprints.js'
