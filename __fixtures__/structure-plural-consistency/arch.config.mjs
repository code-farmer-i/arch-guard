import { library } from '../../es/index.js'

// S31 夹具：同一层里单复数混用（`user` / `order` 是单数，`notifications` 是复数）→ 报，
// 并按多数派给出建议（这里是"统一成单数"）。词形判据来自 src/data/plural-forms.ts（pluralize）。
export default {
  presets: [library({ entry: [] })],
  overrides: {
    roles: [
      { id: 'test', pattern: '**/*.test.{ts,tsx}', layer: 99, exclusive: true },
      {
        id: 'entities:index',
        pattern: 'src/entities/{slice}/index.ts',
        layer: 2,
        group: 'slice',
        entry: true,
      },
      { id: 'entities:ui', pattern: 'src/entities/{slice}/ui/**', layer: 2, group: 'slice' },
    ],
    structure: { pluralConsistency: [{ dimension: 'slice', layers: [2] }] },
  },
}
