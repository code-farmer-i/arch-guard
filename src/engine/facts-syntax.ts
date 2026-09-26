/**
 * facts 提取用的**纯语法小工具**（从 `facts.ts` 拆出来：那一份同时顶到了 500 行文件上限
 * 与 300 行函数上限）。只依赖 TS AST，不碰事实模型。
 */
import ts from 'typescript'

import type { CommentFact } from './types.js'

/** 行列换算（提取与报告都用它） */
const lineOf = (sf: ts.SourceFile, pos: number): number =>
  sf.getLineAndCharacterOfPosition(pos).line + 1

/**
 * 注释采集：用 TS scanner 走**全部**注释 trivia。
 *
 * 不用 `getLeading/TrailingCommentRanges` 逐节点采集 —— 那会漏掉空块里的注释
 * （`catch { /* 忽略 *\/ }`），而「空 catch 是否写明理由」（H05）正好依赖它。
 * scanner 不认识 JSX 文本，所以 JSX 文本里出现 `//` 会被误当注释：这是已知边界。
 */
export function collectComments(
  sf: ts.SourceFile,
  text: string,
  variant: ts.LanguageVariant,
): CommentFact[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ false, variant, text)
  const out: CommentFact[] = []
  let token = scanner.scan()
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const pos = scanner.getTokenPos()
      const end = scanner.getTextPos()
      out.push({
        pos,
        end,
        line: lineOf(sf, pos),
        text: text.slice(pos, end),
        kind: token === ts.SyntaxKind.SingleLineCommentTrivia ? 'line' : 'block',
      })
    }
    token = scanner.scan()
  }
  return out
}

/**
 * 「最近属性名」的**透传容器**：数组 / 对象 / 括号 / 断言 / 展开 / 三元不改变它。
 *
 * 为什么要穿透：`useQuery({ queryKey: ['crews', id] })` 里那个字面量的直接父节点是**数组**，
 * 名字在爷爷那一层 —— 只看直接父节点的话 `StringFact.prop` 永远是 null，
 * 「缓存键唯一出处」（D22）这类规则就没法判。函数体 / 语句 / 调用实参都会**断开**透传
 * （`getKey(['a'])` 里的 `['a']` 不是 `queryKey` 的值）。
 */
export function carriesProp(node: ts.Node): boolean {
  return (
    ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isSpreadElement(node) ||
    ts.isConditionalExpression(node)
  )
}

/** 本级是属性 / JSX 属性时，它带给子树的属性名 */
export function declaredPropOf(node: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isPropertyAssignment(node)) return node.name.getText(sf)
  if (ts.isJsxAttribute(node)) return node.name.getText(sf)
  return null
}

export function stringContext(parent: ts.Node | undefined): string {
  if (!parent) return 'other'
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return 'module'
  if (ts.isCallExpression(parent)) return 'call-arg'
  if (ts.isJsxAttribute(parent)) return 'jsx-attr'
  if (ts.isPropertyAssignment(parent)) return 'property-value'
  if (ts.isElementAccessExpression(parent)) return 'element-access'
  return 'other'
}

export function containsJsx(node: ts.Node): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}
