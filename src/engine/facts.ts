import ts from 'typescript'

import { assertTypeScriptApi } from './ts-api.js'

import type { CommentFact, Facts, FileRecord } from './types.js'

/**
 * 事实模型（facts）：引擎里**唯一**接触 TS AST 的地方。
 * 规则只消费这里产出的纯 JSON —— 换 parser 只需重写本文件（见 docs/DESIGN.md §6.1.1）。
 */

// typescript@7 是原生重写，JS 侧不再暴露编译期 API；这里 fail-fast 给出可执行报错
assertTypeScriptApi(ts)

interface SourceFileWithDiagnostics extends ts.SourceFile {
  parseDiagnostics?: ts.Diagnostic[]
}

const SCRIPT_KIND: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
}

export const TS_EXTENSIONS: string[] = Object.keys(SCRIPT_KIND)

const lineOf = (sf: ts.SourceFile, pos: number): number =>
  sf.getLineAndCharacterOfPosition(pos).line + 1

function scriptKindOf(file: string): ts.ScriptKind {
  const dot = file.lastIndexOf('.')
  return SCRIPT_KIND[file.slice(dot)] ?? ts.ScriptKind.TS
}

/** 注释：走 TS 的 comment range API，避免正则把字符串里的 // 当注释 */
/**
 * 注释采集：用 TS scanner 走**全部**注释 trivia。
 *
 * 不用 `getLeading/TrailingCommentRanges` 逐节点采集 —— 那会漏掉空块里的注释
 * （`catch { /* 忽略 *\/ }`），而「空 catch 是否写明理由」（H05）正好依赖它。
 * scanner 不认识 JSX 文本，所以 JSX 文本里出现 `//` 会被误当注释：这是已知边界。
 */
function collectComments(
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

function propNameOf(node: ts.Node): string | null {
  const parent = node.parent as ts.Node | undefined
  if (!parent) return null
  if (ts.isPropertyAssignment(parent)) return parent.name.getText()
  if (ts.isJsxAttribute(parent)) return parent.name.getText()
  return null
}

function stringContext(node: ts.Node): string {
  const parent = node.parent as ts.Node | undefined
  if (!parent) return 'other'
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return 'module'
  if (ts.isCallExpression(parent)) return 'call-arg'
  if (ts.isJsxAttribute(parent)) return 'jsx-attr'
  if (ts.isPropertyAssignment(parent)) return 'property-value'
  if (ts.isElementAccessExpression(parent)) return 'element-access'
  return 'other'
}

function containsJsx(node: ts.Node): boolean {
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

export interface FactInput {
  file: string
  rel: string
  role: string
  text: string
}

export function extractFacts(input: FactInput): Facts {
  const { file, rel, role, text } = input
  const scriptKind = scriptKindOf(file)
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  ) as SourceFileWithDiagnostics

  // scanner 需要 LanguageVariant 而不是 ScriptKind（JSX 变体才能正确扫描 JSX）
  const variant =
    scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard
  const positioned = collectComments(sf, text, variant)
  const facts: Facts = {
    file,
    rel,
    role,
    lineCount: text.split('\n').length,
    parseErrors: (sf.parseDiagnostics ?? []).map((diagnostic) => ({
      line: diagnostic.start === undefined ? 1 : lineOf(sf, diagnostic.start),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    })),
    imports: [],
    exports: [],
    strings: [],
    jsxText: [],
    calls: [],
    catches: [],
    functions: [],
    anyNodes: [],
    nonNull: [],
    comments: positioned.map(({ line, text: body, kind, pos, end }) => ({
      line,
      text: body,
      kind,
      pos,
      end,
    })),
    hasJsx: false,
  }

  const visit = (node: ts.Node): void => {
    /* ---- import / re-export ---- */
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      facts.imports.push({
        spec: node.moduleSpecifier.text,
        line: lineOf(sf, node.getStart(sf)),
        typeOnly: node.importClause?.isTypeOnly === true,
        dynamic: false,
      })
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        facts.imports.push({
          spec: node.moduleSpecifier.text,
          line: lineOf(sf, node.getStart(sf)),
          typeOnly: node.isTypeOnly,
          dynamic: false,
        })
      }
      const start = lineOf(sf, node.getStart(sf))
      if (!node.exportClause) {
        facts.exports.push({
          name: '*',
          kind: 're-export',
          isStar: true,
          isDefault: false,
          typeOnly: node.isTypeOnly,
          line: start,
        })
      } else if (ts.isNamespaceExport(node.exportClause)) {
        facts.exports.push({
          name: node.exportClause.name.text,
          kind: 're-export',
          isStar: false,
          isDefault: false,
          typeOnly: node.isTypeOnly,
          line: start,
        })
      } else {
        for (const element of node.exportClause.elements) {
          facts.exports.push({
            name: element.name.text,
            kind: 're-export',
            isStar: false,
            isDefault: false,
            typeOnly: node.isTypeOnly || element.isTypeOnly,
            line: lineOf(sf, element.getStart(sf)),
          })
        }
      }
    } else if (ts.isExportAssignment(node)) {
      facts.exports.push({
        name: 'default',
        kind: 'assignment',
        isStar: false,
        isDefault: true,
        typeOnly: false,
        line: lineOf(sf, node.getStart(sf)),
        declared: true,
      })
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0]
      if (argument && ts.isStringLiteral(argument)) {
        facts.imports.push({
          spec: argument.text,
          line: lineOf(sf, node.getStart(sf)),
          typeOnly: false,
          dynamic: true,
        })
      }
    }

    /* ---- 声明型导出 ---- */
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
    const isExported =
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
    const isDefaultKeyword =
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) === true
    if (isExported || isDefaultKeyword) {
      let kind = 'const'
      let name = 'default'
      if (ts.isFunctionDeclaration(node)) {
        kind = 'function'
        name = node.name?.text ?? 'default'
      } else if (ts.isClassDeclaration(node)) {
        kind = 'class'
        name = node.name?.text ?? 'default'
      } else if (ts.isInterfaceDeclaration(node)) {
        kind = 'interface'
        name = node.name.text
      } else if (ts.isTypeAliasDeclaration(node)) {
        kind = 'type'
        name = node.name.text
      } else if (ts.isEnumDeclaration(node)) {
        kind = 'enum'
        name = node.name.text
      } else if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0]
        const initializer = declaration?.initializer
        kind =
          initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            ? 'arrow'
            : 'const'
        name =
          declaration?.name && ts.isIdentifier(declaration.name) ? declaration.name.text : 'default'
      }
      facts.exports.push({
        name,
        kind,
        isStar: false,
        isDefault: isDefaultKeyword || name === 'default',
        typeOnly: kind === 'type' || kind === 'interface',
        line: lineOf(sf, node.getStart(sf)),
        declared: true,
      })
    }

    /* ---- 字面量 ---- */
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      facts.strings.push({
        value: node.text,
        line: lineOf(sf, node.getStart(sf)),
        context: stringContext(node),
        prop: propNameOf(node),
      })
    }
    if (ts.isJsxText(node)) {
      const value = node.text.trim()
      if (value) facts.jsxText.push({ value, line: lineOf(sf, node.getStart(sf)) })
    }
    if (
      !facts.hasJsx &&
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
    )
      facts.hasJsx = true

    /* ---- 调用 / debugger ---- */
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      // 记录**所有**调用：裸调用（alert/confirm/prompt）也要能被 H03 看见
      const first = node.arguments?.[0]
      const prefixOf = (arg: ts.Expression | undefined): string | undefined => {
        if (!arg || !ts.isTemplateExpression(arg)) return undefined
        return arg.head.text || undefined
      }
      facts.calls.push({
        callee: node.expression.getText(sf),
        line: lineOf(sf, node.getStart(sf)),
        ...(first && ts.isStringLiteralLike(first) ? { stringArg: first.text } : {}),
        ...(prefixOf(first) ? { keyPrefix: prefixOf(first) as string } : {}),
      })
    }
    if (node.kind === ts.SyntaxKind.DebuggerStatement) {
      facts.calls.push({ callee: 'debugger', line: lineOf(sf, node.getStart(sf)) })
    }

    /* ---- 异常吞咽 ---- */
    if (ts.isCatchClause(node)) {
      const start = node.getStart(sf)
      const end = node.getEnd()
      const hasComment = positioned.some((comment) => comment.pos >= start && comment.pos < end)
      facts.catches.push({
        line: lineOf(sf, start),
        statements: node.block.statements.length,
        hasComment,
      })
    }

    /* ---- 函数体量 ---- */
    let functionInfo: { name: string; start: number; end: number } | null = null
    if (ts.isFunctionDeclaration(node)) {
      functionInfo = {
        name: node.name?.text ?? '(anonymous)',
        start: node.getStart(sf),
        end: node.getEnd(),
      }
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const parent = node.parent as ts.Node | undefined
      const name = parent && ts.isVariableDeclaration(parent) ? parent.name.getText() : '(fn)'
      functionInfo = { name, start: node.getStart(sf), end: node.getEnd() }
    }
    if (functionInfo) {
      const body =
        ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)
          ? node.body
          : undefined
      facts.functions.push({
        name: functionInfo.name,
        line: lineOf(sf, functionInfo.start),
        lines: lineOf(sf, functionInfo.end) - lineOf(sf, functionInfo.start) + 1,
        isComponent:
          /^[A-Z]/.test(functionInfo.name) && body !== undefined && ts.isBlock(body)
            ? containsJsx(body)
            : false,
      })
    }

    /* ---- 类型逃生舱 ---- */
    if (node.kind === ts.SyntaxKind.AnyKeyword)
      facts.anyNodes.push({ line: lineOf(sf, node.getStart(sf)) })
    if (ts.isNonNullExpression(node)) facts.nonNull.push({ line: lineOf(sf, node.getStart(sf)) })

    ts.forEachChild(node, visit)
  }

  visit(sf)
  return facts
}

/** 供其它模块把 FileRecord 转成事实输入 */
export function factInputOf(record: FileRecord, text: string): FactInput {
  return { file: record.abs, rel: record.rel, role: record.role, text }
}
