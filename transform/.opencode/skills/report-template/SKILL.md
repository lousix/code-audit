---
name: report-template
description: "Structured security audit report template with executive summary, vulnerability details, attack chain analysis, and remediation roadmap."
---

# Report Template Skill

> 安全审计报告模板 — 报告架构、漏洞模板、质量标准

## 报告总体架构

```
1. 执行摘要（1页）── 审计范围、关键发现统计、最高风险总结
2. 漏洞统计表 ── 按等级汇总: Critical×N, High×N, Medium×N, Low×N
3. 漏洞详情（按等级降序）── Critical → High → Medium → Low
4. 攻击链分析 ── 多漏洞串联的端到端攻击路径
5. 修复优先级建议 ── 按业务影响排序的修复路线图
6. 正面发现 ── 项目做得好的安全实践
```

**每个漏洞条目必须包含**: 编号与标题(如C-01) | 属性表(严重程度/CVSS/CWE) | 漏洞位置(文件:行号) | 漏洞代码 | Sink链 | 详细分析 | 利用方式 | 修复建议

## 报告质量标准

| 标准 | 要求 |
|------|------|
| **可定位** | 每个漏洞有精确的文件路径和行号 |
| **可复现** | 提供足够信息让开发者复现问题 |
| **可修复** | 给出具体的代码修复方案，不是泛泛而谈 |
| **无误报** | 每个漏洞都经过数据流验证 |
| **完整分析** | 不仅说"有问题"，还说明完整利用路径和影响 |

## 漏洞报告模板 (简洁版)

```markdown
## [严重程度] 漏洞标题

### 概述
简要描述漏洞性质和影响。

### 受影响组件
- **文件**: `path/to/file.py:42`
- **函数**: `vulnerable_function()`

### Sink 链
[按严重度使用对应格式]

### 漏洞代码
[代码片段]

### 攻击向量
描述攻击者如何利用此漏洞。

### PoC
具体的利用步骤或payload

### 修复建议
[修复代码示例]

### 参考
- CWE-XXX
```

## 污点分析报告模板

> 完整模板: `references/core/taint_analysis.md`
> 格式: 基本信息(类型/CWE) → Source(位置/类型/代码) → Propagation(逐步路径) → Sink(位置/危害) → 分析结论(净化/复杂度) → PoC+修复

## 置信度标注

```
- [已验证]  ①完整数据流 ②无有效防护 ③可构造输入
- [高置信]  满足 ①+②，缺③
- [中置信]  仅满足①
- [需验证]  仅Grep命中

Critical/High: 必须 [高置信] 或 [已验证]
Medium: 允许 [中置信]
Low/Info: 允许 [需验证]
```
