import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseCss } from '../../../engine/css.js'
import type { Facts, Finding, RuleContext } from '../../../engine/types.js'

export interface ContrastPair {
  fg: string
  bg: string
  /** bg 是半透明柔底时，压在哪个底色上算 */
  parent?: string
  usage: string
  min: number
}

export interface DesignParams {
  tokenPrefix: string
  spacing: string
  themes: string[]
  styleDir: string
  tokenDir: string
  vendorDir: string
  paletteFile: string
  themeFile: string
  storageFile: string
  htmlKeys: string[]
  contrastPairs: ContrastPair[]
  lengthProps: string[]
  allowLengthValues: string[]
}

const DEFAULTS: Omit<
  DesignParams,
  'contrastPairs' | 'lengthProps' | 'allowLengthValues' | 'themes' | 'htmlKeys'
> = {
  tokenPrefix: '--sh',
  spacing: '--spacing',
  styleDir: 'src/shared/styles',
  tokenDir: 'src/shared/styles/tokens',
  vendorDir: 'src/shared/styles/vendor',
  paletteFile: 'src/shared/styles/tokens/palette.css',
  themeFile: 'src/shared/styles/tokens/theme.css',
  storageFile: 'src/shared/config/storage.ts',
}

export function designParams(ctx: RuleContext): DesignParams {
  const p = ctx.config.params as Partial<DesignParams>
  return {
    ...DEFAULTS,
    themes: p.themes ?? ['dark', 'light'],
    htmlKeys: p.htmlKeys ?? ['theme'],
    contrastPairs: p.contrastPairs ?? [],
    lengthProps: p.lengthProps ?? [],
    allowLengthValues: p.allowLengthValues ?? ['0'],
  }
}

export const finding = (
  rule: string,
  file: string,
  line: number,
  text: string,
  hint?: string,
): Finding => ({
  rule,
  file,
  line,
  text,
  ...(hint ? { hint } : {}),
})

/** 用事实模型里的注释区间把注释遮罩成空格（避免注释里的示例被误判） */
export function maskTs(text: string, facts: Facts | undefined): string {
  if (!facts || facts.comments.length === 0) return text
  const chars = [...text]
  for (const comment of facts.comments) {
    for (let i = comment.pos; i < comment.end; i += 1) if (chars[i] !== '\n') chars[i] = ' '
  }
  return chars.join('')
}

export interface CssFile {
  rel: string
  text: string
  masked: string
  vars: { name: string; value: string; line: number }[]
  varRefs: { name: string; line: number; hasFallback: boolean }[]
  selectors: { selector: string; line: number }[]
  rules: {
    selector: string
    line: number
    declarations: { prop: string; value: string; line: number }[]
    vars: { name: string; value: string; line: number }[]
  }[]
}

export function cssFiles(ctx: RuleContext): CssFile[] {
  return ctx.records
    .filter((record) => record.kind === 'css')
    .map((record) => {
      const text = ctx.sourceOf(record.rel) ?? ''
      return { ...parseCss(record.rel, text), text, masked: text }
    })
}

export const isTokenFile = (rel: string, params: DesignParams): boolean =>
  rel.startsWith(`${params.tokenDir}/`)

/** 规则需要读项目里任意文件（如 index.html）时的兜底 */
export function tryRead(ctx: RuleContext, rel: string): string | null {
  const direct = ctx.sourceOf(rel)
  if (direct !== undefined) return direct
  try {
    return readFileSync(join(ctx.config.root, rel), 'utf8')
  } catch {
    return null
  }
}
