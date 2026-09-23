import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * git 相关的事实采集（scope 的变更集、M06 用的提交时间）。
 *
 * 抽出来的理由很实际：`run.ts` 已经贴着本体自己的 500 行上限（eslint `max-lines`），
 * 而这几段与编排无关，只跟「怎么问 git、问不到怎么降级」有关。
 */

/** 最近一次提交的时间（M06 用来判「覆盖率产物是不是过期的」）；没有 git 或没有提交时返回 null */
export function gitHeadTimeMs(root: string): number | null {
  try {
    const seconds = execFileSync('git', ['-C', root, 'log', '-1', '--format=%ct'], {
      encoding: 'utf8',
      // 同上：没有 git 时不能把 git 的报错透传到用户屏幕上
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const value = Number.parseInt(seconds, 10)
    return Number.isFinite(value) ? value * 1000 : null
  } catch {
    return null
  }
}

/**
 * `--paths` 的模式归一：绝对路径（含绝对 glob）换算成配置根相对路径；相对模式原样返回。
 *
 * 为什么要它：诊断/编辑器插件按文件传参时给绝对路径，而报告里的路径都是配置根相对的；
 * 不换算就会全部过滤掉 —— 那是「假绿」，比报错危险。
 */
export function rootRelativePattern(pattern: string, root: string): string {
  if (!pattern.startsWith('/')) return pattern
  const real = (path: string): string => {
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }
  const realRoot = real(root)
  // 常见形态一：绝对路径直接以配置根开头（含 glob 也适用，因为是纯字符串剥离）
  if (pattern === root) return ''
  if (pattern.startsWith(`${root}/`)) return pattern.slice(root.length + 1)
  if (pattern.startsWith(`${realRoot}/`)) return pattern.slice(realRoot.length + 1)
  // 形态二：软链写法不同（/var vs /private/var）→ 只对通配符之前的前缀做 realpath 后算相对
  const literal = pattern.replace(/[?*[\]].*$/, '')
  const tail = pattern.slice(literal.length)
  return `${relative(realRoot, real(literal)).split('\\').join('/')}${tail}`
}

/** git 变更集：untracked 必须纳入，rename 按改名处理（见 docs/DESIGN.md §6.8） */
export function gitChangedFiles(
  root: string,
  scope: string,
): { files: string[]; notice?: string } | null {
  const git = (args: string[]): string[] =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      // stderr 默认是透传的：在没有 git 的目录里，git 自己那句「致命错误」会打到用户屏幕上，
      // 而这里本来就会 catch 掉并走「明确降级」分支 —— 噪音不该漏出去。
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  try {
    // 变更路径是相对**仓库根**的；配置根可能不是仓库根，必须换算，否则会路径对不上而假绿
    const top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    let raw: string[]
    if (scope === 'staged') raw = git(['diff', '--cached', '--name-only', '--find-renames', 'HEAD'])
    else if (scope === 'changed') {
      raw = [
        ...git(['diff', '--name-only', '--find-renames', 'HEAD']),
        ...git(['ls-files', '--others', '--exclude-standard']),
      ]
    } else if (scope.startsWith('since:')) {
      raw = git(['diff', '--name-only', '--find-renames', `${scope.slice('since:'.length)}...HEAD`])
    } else {
      return null
    }
    // macOS 上 /var 与 /private/var 是同一目录的两种写法（CI 容器里也常见 /tmp 软链）：
    // 不先 realpath 就做 relative 会算出 `../../..`，变更路径与文件全都对不上 → **假绿**。
    const real = (path: string): string => {
      try {
        return realpathSync(path)
      } catch {
        return path
      }
    }
    const realRoot = real(root)
    const realTop = real(top)
    const files = raw.map((path) =>
      relative(realRoot, real(join(realTop, path)))
        .split('\\')
        .join('/'),
    )
    return realTop === realRoot
      ? { files }
      : { files, notice: `仓库根是 ${top}，变更路径已换算到配置根` }
  } catch {
    return null
  }
}
