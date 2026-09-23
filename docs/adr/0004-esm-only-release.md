# v0.1 只发布 ESM

`pagoda-cli build` 在 `bundle: false` 下同时产出 `es/*.js`（ESM）与 `lib/*.cjs`（CJS）。源码内部 import 写 `.js` 规范，于是 CJS 产物里的 `require('./engine/types.js')` 指向 `.js`，而 `lib/` 里实际文件是 `.cjs` —— 这条路径是坏的。因此 `files` 只发 `es/` 与 `bin/`，`exports` 只给 `import` 条件。

## Consequences

- Node ≥22.12 的 `require(esm)` 仍能加载主入口，但不作支持承诺。
- 将来要双格式：要么开 `bundle: true`（会失去子路径导出），要么接受 `lib/` 的路径改写。
