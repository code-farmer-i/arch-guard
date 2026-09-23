# oxc spike：换 parser 值不值？

Status: done（结论：**不值**，理由见下）

## 背景

`docs/DESIGN.md` §6.1.1 当初否决 `oxc-parser` 的唯一理由，原文是「引入 native 依赖与多平台二进制，**破坏「整目录复制」**」。
本包已改为 npm 包发布，"整目录复制"不再是发布形态 —— 所以这条否决理由过期了，必须重新量一次。

## 怎么量的

只量**解析**这一步，不动现有 parser（脚本照抄 `ts.createSourceFile(setParentNodes=false)` 与 `oxc.parseSync` 的调用方式，
同一批文件、同一台机器、3 轮取最小、先预热）：

```bash
node compare.mjs /tmp/ag-bench/real    # 3044 文件 / 9.8 MB / 21.5 万行
node compare.mjs /tmp/ag-bench/large   # 26204 小文件 / 3.1 MB
```

## 结果

**真实规模（3044 文件 / 9.8 MB）**

| 阶段                          | 耗时      | 吞吐                   |
| ----------------------------- | --------- | ---------------------- |
| `ts.createSourceFile`（现状） | 1133ms    | 8.7 MB/秒              |
| `oxc.parseSync`               | **511ms** | 19.3 MB/秒（**2.2×**） |
| `extractFacts` 全量（现状）   | 3568ms    | 2.8 MB/秒              |

**26k 小文件**

| 阶段                  | 耗时                        |
| --------------------- | --------------------------- |
| `ts.createSourceFile` | 307ms                       |
| `oxc.parseSync`       | 295ms（**1.0×**，没有收益） |
| `extractFacts` 全量   | 1012ms                      |

## 结论：不值，而且指出了真正的大头

1. **解析只占 extractFacts 的 32%**（1133 / 3568）。换 oxc 的端到端上界 = 省掉 `1133−511 ≈ 620ms`，
   也就是真实规模上 **≈17%**；26k 小文件上是 **≈1%**（每文件开销主导，native 优势消失）。
2. **真正的大头是我们自己的访问器 + 注释扫描**：`extractFacts − 裸解析 ≈ 2.4s`（**67%**）。
   换 parser 要把这 2.4s 的逻辑在 oxc 的 AST 上重写一遍 —— 收益上界不变，风险与工作量全增加。
3. **另加**：native 多平台二进制要随包分发；facts 缓存的键要从 `ts.version` 换成 parser 版本；
   `FACTS_CACHE_SPEC` 要 +1（缓存整体作废一次）。
4. 而且 facts 缓存已经让**重复运行**不再受解析影响（热跑 1.2s vs 冷跑 5.9s），换 parser 只在"冷跑"这一档有小收益。

**所以：不换 parser。** `docs/DESIGN.md` §6.1.1 的表格已把 oxc 行改成「可再评估」，并指向本文件 —— 留证据，免得下次再讨论一遍。

## 下一步该优化哪里（把力气挪对地方）

按收益排序，全在**我们自己的代码**里，不在 parser：

1. **注释扫描**（`collectComments`）：现在为每个文件再整篇 token 扫一遍，只为给指纹规则遮罩注释。
   实测（早期原型）关掉它省 ≈10% 的 extractFacts。可做成**按需**：只有启用 P06/P07/D 掩码的规则时才扫。
2. **`containsJsx`**：每个大写函数都要递归走一遍函数体；可改成"遍历时自底向上标记某节点子树是否含 JSX"，
   一次遍历解决。
3. **`lineOf`**：已是 `sf.getLineStarts()` 二分（早期实测替换 `getLineAndCharacterOfPosition` 无收益，别再动）。
4. **访问器的主循环**：现在对每个节点跑一串 `ts.isXxx` 判断；可按 `node.kind` 先分组再分派，
   减少热路径上的类型守卫次数。

## Comments

- 2026-09-23 spike：结论「不换 parser，改优化自有访问器」。脚本与数字留在本目录，可重跑。
