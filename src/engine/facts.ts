import ts from 'typescript'

import { ENV_READ_ROOTS } from '../data/env-roots.js'

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

/**
 * 下面两个辅助函数**显式接收父节点**，而不是读 `node.parent`。
 *
 * 为什么：`createSourceFile(..., setParentNodes = true)` 会让 TS 给**每个**节点挂父指针，
 * 而解析是 facts 提取的绝对大头；真正需要父节点的只有这里的几处。显式传参后，
 * 解析就能按 DESIGN §6.1.1 写的那样用 `setParentNodes = false`。
 */
/**
 * 「最近属性名」的**透传容器**：数组 / 对象 / 括号 / 断言 / 展开 / 三元不改变它。
 *
 * 为什么要穿透：`useQuery({ queryKey: ['crews', id] })` 里那个字面量的直接父节点是**数组**，
 * 名字在爷爷那一层 —— 只看直接父节点的话 `StringFact.prop` 永远是 null，
 * 「缓存键唯一出处」（D22）这类规则就没法判。函数体 / 语句 / 调用实参都会**断开**透传
 * （`getKey(['a'])` 里的 `['a']` 不是 `queryKey` 的值）。
 */
function carriesProp(node: ts.Node): boolean {
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
function declaredPropOf(node: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isPropertyAssignment(node)) return node.name.getText(sf)
  if (ts.isJsxAttribute(node)) return node.name.getText(sf)
  return null
}

function stringContext(parent: ts.Node | undefined): string {
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

/**
 * 事实模型（facts）是 parser ↔ 规则之间**唯一的契约**，因此只收「有规则在读」的字段。
 *
 * 收一堆没人读的字段不是"以后也许用得上"，而是每次全量解析都要付的真金白银：
 * 早先为 H01（`any` / 非空断言）、H05（空 catch）、D15（内联样式）、C01（JSX 裸文本）
 * 收集的 `anyNodes` / `nonNull` / `catches` / `inlineStyles` / `jsxText` 五组，
 * 在那些规则委派给 eslint 之后就没有消费者了 —— 已删除（见 docs/ECOSYSTEM-AUDIT.md）。
 * **要给新规则加字段：先让规则真的读它，再回这里收集。**
 */
export function extractFacts(input: FactInput): Facts {
  const { file, rel, role, text } = input
  const scriptKind = scriptKindOf(file)
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
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
    reads: [],
    calls: [],
    functions: [],
    comments: positioned.map(({ line, text: body, kind, pos, end }) => ({
      line,
      text: body,
      kind,
      pos,
      end,
    })),
    hasJsx: false,
  }

  const visit = (
    node: ts.Node,
    parent: ts.Node | undefined,
    /** 祖先里**最近的那个属性名**（`queryKey` / `path` / `to`…）：透传容器不改变它 */
    inheritedProp: string | null,
    /** 祖先里**最近的外层调用名**（对象实参里的文案靠它认"这是给谁用的"） */
    inheritedCall: string | null = null,
  ): void => {
    // 传给子孙的"最近属性名"：本级是属性 → 用它；本级只是透传容器 → 继承；其它 → 断开
    const childProp = declaredPropOf(node, sf) ?? (carriesProp(node) ? inheritedProp : null)
    // 调用名：本级是调用 → 取它的 callee；进了函数体 → 断开（参数里的回调与外面那次调用无关）
    const callHere =
      ts.isCallExpression(node) || ts.isNewExpression(node) ? node.expression.getText(sf) : null
    const childCall = callHere ?? (ts.isFunctionLike(node) ? null : inheritedCall)
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

    /* ---- 环境读取（成员访问链的最外层） ---- */
    if (ts.isPropertyAccessExpression(node)) {
      const outermost = !(
        parent &&
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node
      )
      if (outermost) {
        const chain = node.getText(sf)
        if (ENV_READ_ROOTS.some((root) => chain === root || chain.startsWith(`${root}.`))) {
          facts.reads.push({ name: chain, line: lineOf(sf, node.getStart(sf)) })
        }
      }
    }

    /* ---- 字面量 ---- */
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      facts.strings.push({
        value: node.text,
        line: lineOf(sf, node.getStart(sf)),
        context: stringContext(parent),
        // 最近的那个属性名（不一定是直接父节点：`queryKey: ['a']` 的字面量在数组里）
        prop: inheritedProp,
        ...(inheritedCall ? { inCall: inheritedCall } : {}),
      })
    }
    /**
     * JSX 文本节点（`<button>保存</button>` 里的那半）也进 `strings`，`context` 标成 `jsx`。
     *
     * 它**不是字符串字面量** —— 只收字面量的话，"写死在 JSX 里的文案"永远看不见（C01 的主体）。
     * 纯空白（标签之间的缩进换行）跳过，否则每个 JSX 文件都会多出一堆噪音。
     */
    if (ts.isJsxText(node)) {
      const text = node.text.trim()
      if (text !== '') {
        facts.strings.push({
          value: text,
          line: lineOf(sf, node.getStart(sf)),
          context: 'jsx',
          prop: null,
        })
      }
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

    /* ---- 函数体量 ---- */
    let functionInfo: { name: string; start: number; end: number } | null = null
    if (ts.isFunctionDeclaration(node)) {
      functionInfo = {
        name: node.name?.text ?? '(anonymous)',
        start: node.getStart(sf),
        end: node.getEnd(),
      }
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const name = parent && ts.isVariableDeclaration(parent) ? parent.name.getText(sf) : '(fn)'
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

    ts.forEachChild(node, (child) => visit(child, node, childProp, childCall))
  }

  visit(sf, undefined, null)
  return facts
}

/** 供其它模块把 FileRecord 转成事实输入 */
export function factInputOf(record: FileRecord, text: string): FactInput {
  return { file: record.abs, rel: record.rel, role: record.role, text }
}
