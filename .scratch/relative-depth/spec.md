# 禁相对越级（C9）

Status: done

## 场景（对应 REQUIREMENTS.md 的 R-16）

- `import { format } from '../../../shared/lib/format'` —— 爬到目录边界之外后，
  **看不出这条依赖跨没跨界**（同层？跨域？跨层？）；目录一挪全崩。**修前：不报**
  （委派给 eslint `no-restricted-imports`，那段 patterns 要项目自己写，"几层算越级"还因项目而异）。

## 目标

- 声明 `structure.maxRelativeUp: { max: N }` 后：`../` 爬过的层数 > N 即报（**不声明不判**）。
- `../x` 记 1 层、`../../x` 记 2 层；`./x` 与别名 / 包路径记 0。

## 非目标

- 不判"这个文件该放哪"（那是目录契约的事）。
- 不强制"跨组必须别名"——那是 **S32 导入局部性**（已实现，声明才判），两条互补。

## 验收标准

- 夹具 `relative-depth`：上限 1 时 `../../../shared/lib/format`（3 层）报；`../hooks/helper`（1 层）与 `@/...` 不报。
- 单测：`maxRelativeUp` 未声明不判；`max` 为负 → 解析配置直接报错。
- 双 Node `pnpm check` EXIT=0；DESIGN §5.1 有 S43 行。

## 边界与取舍

- **只数前导 `../`**：`./../x` 这种写法不常见，按 0 层处理（宁少报不误伤）。
- **上限由项目声明**：不同目录深度的项目"越级"的定义不同，猜一个默认值会把正常项目报红。
- **与 S32 的分工**：S32 需要"组维度"知识（`importLocality`），这条只看路径本身 ——
  所以哪怕项目没有组维度概念，这条也能用（这正是收回它的价值）。
- **被否方案**：内置一个默认上限（如 2）—— 项目规模差异太大；按"跨出 src 根"判 —— 与 S32 重复。

## Comments

- 2026-09-25 委派评审（`docs/DELEGATION-REVIEW.md`）列入 C9；用户选择全部实现。原委派去向 eslint
  `no-restricted-imports` 的成本是"项目要自己写一段 patterns"，而我们的路径事实现成。
