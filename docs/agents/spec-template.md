# 特性规格模板

`.scratch/<feature-slug>/spec.md` 回答「**这个特性要做什么、怎么算做完**」。

它**不**回答「系统整体是什么」（那是 `PARADIGM.md` 与 `docs/SPEC.md`），也**不**汇报进度（那是 `README.md` 的 Roadmap 与 `CHANGELOG.md`）—— 把这三件事混进一个文件，结局是 sediment：没人敢删、也没人读得完。

```md
# {特性名}

Status: draft | ready-for-agent | in-progress | done

## 背景与问题

现在有什么做不到、谁被卡住。不复述已有设计。

## 目标

- 动词开头的可验收行为。

## 非目标

- 明确不做的，以及为什么。

## 验收标准

- 每条都能被命令或夹具判定：跑什么、期望什么。

## 边界与取舍

- 已知会漏的场景、误报风险、被否掉的方案（一句话理由）。

## Comments

- YYYY-MM-DD 谁提了什么、结论是什么（**追加**，不覆盖上文）。
```
