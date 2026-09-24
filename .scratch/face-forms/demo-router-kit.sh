#!/usr/bin/env bash
# 「router kit 到底约束了什么」的可复现演示：6 个最小宿主项目 + 真实门禁输出。
#
# 跑法：bash .scratch/face-forms/demo-router-kit.sh
# 需要先在仓库根 `pnpm build`（脚本用的是 es/cli.js，即构建产物）。
#
# 场景：
#   A 声明了 react-router 但 package.json 没装        → P04（正向）
#   B 登记 react-router 却 import 同类库 wouter        → P12
#   C 配置式路由：域入口叫 routes.ts                    → ✔ 通过（旧代码在这里报 S05 假阳性）
#   D 把入口改名 router.ts，**只改 kit**                → S03 说清"角色表没跟上"
#   D2 同样的改名 + 角色表跟上                          → ✔ 通过（推荐路径）
#   E 文件路由 noneRouterKit({ routeFiles: [] }) + 域根散件 → 只报 S03（其余入口规则停判）
#   F 声明了 react-router 却一个 import 都没有          → ✔ 通过（P11 明列停用：路由面没有"没用"看门狗）
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
BASE=${BASE:-/tmp/router-kit-demo}
rm -rf "$BASE"
mkdir -p "$BASE"

skeleton() { # $1 = 目录
  local d="$1"
  mkdir -p "$d/src/app/router" "$d/src/modules/crews/views"
  cat > "$d/package.json" <<'EOF'
{"name":"demo","private":true,"type":"module","dependencies":{}}
EOF
  cat > "$d/tsconfig.json" <<'EOF'
{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./src/*"]}}}
EOF
  cat > "$d/src/app/main.tsx" <<'EOF'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { routes } from './router'

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
export default routes
EOF
  cat > "$d/src/app/App.tsx" <<'EOF'
export function App() {
  return <div className="app" />
}
EOF
  cat > "$d/src/app/router/index.ts" <<'EOF'
import { crewsRoutes } from '@/modules/crews/routes'

export const routes = [...crewsRoutes]
EOF
  cat > "$d/src/modules/crews/routes.ts" <<'EOF'
export const crewsRoutes = [{ path: '/crews', lazy: () => import('./views/CrewsPage') }]
EOF
  cat > "$d/src/modules/crews/views/CrewsPage.tsx" <<'EOF'
export default function CrewsPage() {
  return <div>crews</div>
}
EOF
}

config() { # $1 = 目录  $2 = 预设表达式  $3 = enable 列表
  cat > "$1/arch.config.mjs" <<EOF
import { canonical, reactRouterKit, router } from '$ROOT/es/index.js'

export default {
  presets: [$2],
  overrides: { enable: [$3], ignore: ['arch.config.mjs', 'expect.json', 'tsconfig.json'] },
}
EOF
}

run() {
  echo "════════════════════════════════════════ $1"
  ( cd "$BASE/$1" && node "$ROOT/es/cli.js" 2>&1 | grep -vE '^\s*·|^$' | head -12 ) || true
  echo
}

# A：声明了 react-router，但 package.json 里没装
skeleton "$BASE/A-missing-package"
config "$BASE/A-missing-package" 'canonical(), router(reactRouterKit())' "'P04'"
# B：登记了 react-router，代码里却 import 了 wouter
skeleton "$BASE/B-mixed-scheme"
cat > "$BASE/B-mixed-scheme/package.json" <<'EOF'
{"name":"demo","private":true,"type":"module","dependencies":{"react-router":"7.0.0","react-router-dom":"7.0.0","wouter":"3.0.0"}}
EOF
cat > "$BASE/B-mixed-scheme/src/modules/crews/routes.ts" <<'EOF'
import { route } from 'wouter'

export const crewsRoutes = [route('/crews', () => import('./views/CrewsPage'))]
EOF
config "$BASE/B-mixed-scheme" 'canonical(), router(reactRouterKit())' "'P12'"
# C：配置式路由 —— 域入口就是 routes.ts（默认词汇已认）
skeleton "$BASE/C-routes-ts"
config "$BASE/C-routes-ts" 'canonical(), router(reactRouterKit())' "'S03','S04','S05','S14','S15'"
# C-old：同一个宿主，用**改动前**的构建产物跑（需要自己准备一个旧 revision 的 es/）
if [ -n "${OLD_ROOT:-}" ] && [ -f "$OLD_ROOT/es/cli.js" ]; then
  rm -rf "$BASE/C-old" && cp -R "$BASE/C-routes-ts/." "$BASE/C-old/"
  sed -i '' "s#$ROOT/es/index.js#$OLD_ROOT/es/index.js#" "$BASE/C-old/arch.config.mjs"
  echo "════════════════════════════════════════ C-old（改动前 $OLD_ROOT）"
  ( cd "$BASE/C-old" && node "$OLD_ROOT/es/cli.js" 2>&1 | grep -vE '^\s*·|^$' | head -8 ) || true
  echo
fi
# D：入口改名 router.ts —— **只改 kit**（角色表没跟上）
# D2：同样的改名 + 角色表跟上（推荐路径）
for name in D-kit-only D2-kit-and-roles; do
  skeleton "$BASE/$name"
  mv "$BASE/$name/src/modules/crews/routes.ts" "$BASE/$name/src/modules/crews/router.ts"
  cat > "$BASE/$name/src/app/router/index.ts" <<'EOF'
import { crewsRoutes } from '@/modules/crews/router'

export const routes = [...crewsRoutes]
EOF
  cat > "$BASE/$name/src/modules/crews/router.ts" <<'EOF'
export const crewsRoutes = [{ path: '/crews', lazy: () => import('./views/CrewsPage') }]
EOF
done
cat > "$BASE/D-kit-only/arch.config.mjs" <<EOF
import { canonical, reactRouterKit, router } from '$ROOT/es/index.js'

// 只声明词汇，角色表还是 canonical 的 routes.{ts,tsx}
export default {
  presets: [canonical(), router(reactRouterKit({ routeFiles: ['router.ts'] }))],
  overrides: {
    enable: ['S03', 'S04', 'S05', 'S14', 'S15'],
    ignore: ['arch.config.mjs', 'expect.json', 'tsconfig.json'],
  },
}
EOF
cat > "$BASE/D2-kit-and-roles/arch.config.mjs" <<EOF
import { canonical, reactRouterKit, router } from '$ROOT/es/index.js'

// 词汇 + 角色表一起改（推荐路径）：入口才进解析集，图规则才看得到它的 import
export default {
  presets: [canonical(), router(reactRouterKit({ routeFiles: ['router.ts'] }))],
  overrides: {
    addRoles: [
      { id: 'module:router', pattern: 'src/modules/{domain}/router.ts', layer: 10, slot: 'routes' },
    ],
    enable: ['S03', 'S04', 'S05', 'S14', 'S15'],
    ignore: ['arch.config.mjs', 'expect.json', 'tsconfig.json'],
  },
}
EOF
# E：文件路由（noneRouterKit({ routeFiles: [] })）+ 域根散件
skeleton "$BASE/E-file-routing"
cat > "$BASE/E-file-routing/src/modules/crews/helpers.ts" <<'EOF'
export const helper = (v: string) => v.trim()
EOF
cat > "$BASE/E-file-routing/arch.config.mjs" <<EOF
import { canonical, noneRouterKit, router } from '$ROOT/es/index.js'

// 文件路由：路由由目录约定产生，没有 per-domain 出口文件
export default {
  presets: [canonical(), router(noneRouterKit({ routeFiles: [] }))],
  overrides: {
    enable: ['S03', 'S04', 'S05', 'S14', 'S15'],
    ignore: ['arch.config.mjs', 'expect.json', 'tsconfig.json'],
  },
}
EOF
# F：声明了 react-router 却一个 import 都没有
skeleton "$BASE/F-declared-unused"
cat > "$BASE/F-declared-unused/package.json" <<'EOF'
{"name":"demo","private":true,"type":"module","dependencies":{"react-router":"7.0.0","react-router-dom":"7.0.0"}}
EOF
config "$BASE/F-declared-unused" 'canonical(), router(reactRouterKit())' "'P04','P11'"

for c in A-missing-package B-mixed-scheme C-routes-ts D-kit-only D2-kit-and-roles E-file-routing F-declared-unused; do
  run "$c"
done
