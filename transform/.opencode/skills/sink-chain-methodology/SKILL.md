---
name: sink-chain-methodology
description: "Sink chain deep tracing methodology with graded code output templates (Critical full-chain / High-Medium key-nodes), reverse tracking rules, and per-hop Read verification."
---

# Sink Chain Methodology Skill

> Sink 链深度追踪方法论 — 分级代码链输出模板、反向追踪规则、每一跳 Read 验证

## 核心原则

发现任何 Sink 函数后，不能仅报告 Sink 位置，**必须**追踪完整的数据流链路并附带实际代码证据。

---

## 数据转换管道追踪

发现 Sink 函数后，不仅追踪直接调用者，还必须向上追踪中间构造/转换层:

**数据流模型**: Source → [Transform₁ → Transform₂ → ... → Transformₙ] → Sink

**典型中间层命名模式**: *Builder, *Provider, *Manager, *Utils, *Helper, *Handler, *Str*, *Trans*, *Process*, *Assemble*, *Render*, *Compile*

**追踪操作**:
1. 对每个 Sink → Grep 调用位置 → 对调用者 Grep 输入来源
2. 重复直到找到外部输入(Source) 或到达 3 层上限
3. **每层用 Read offset/limit 验证实际代码，记录 file:line + 关键代码片段**
4. 中间转换层若接受外部参数但无清洗/参数化 → 标记为独立注入入口

此规则确保不遗漏"Source 经过 Builder/Provider 间接到达 Sink"的注入路径。

---

## 反向追踪规则（强制）

1. **至少 3 层**: Sink → 调用者 → 调用者的调用者 → Source
2. **每一跳必须 Read**: 不可基于推测，必须 Read 实际代码
3. **记录格式**: file:line + 3-5行关键代码片段（Critical）或 2-3行（High/Medium）
4. **净化点标注**: 遇到净化/过滤函数时，必须记录并评估是否可绕过
5. **断链处理**: 若某一跳无法继续追踪，标注断点位置和原因

---

## 两级 Sink 链输出模板

### Critical 漏洞 — 完整代码链

每一跳都附带实际代码片段:

```
[SINK-CHAIN] Source → Transform1 → Transform2 → ... → Sink
├── Source: {file}:{line}
│   ```{lang}
│   {code_snippet 3-5行}
│   ```
│   类型: {HTTP参数/配置/数据库/文件...}
│
├── Transform1: {file}:{line}
│   ```{lang}
│   {code_snippet 3-5行}
│   ```
│   转换说明: {如: 字符串拼接/格式化/编码转换}
│
├── Transform2: {file}:{line}
│   ```{lang}
│   {code_snippet 3-5行}
│   ```
│   净化检查: {无净化/有净化但可绕过(原因)/有效净化}
│
└── Sink: {file}:{line}
    ```{lang}
    {code_snippet 3-5行}
    ```
    危险函数: {函数名}
    影响: {RCE/数据泄露/文件读写/...}
```

### High/Medium 漏洞 — 关键节点模式

仅 Source、净化点、Sink 附带代码，中间节点用 file:line 简写:

```
[SINK-CHAIN] Source → ... → Sink
├── Source: {file}:{line}
│   ```{lang}
│   {code_snippet 2-3行}
│   ```
│
├── 中间节点: {file1}:{line} → {file2}:{line} → {file3}:{line}
│
├── 净化点: {file}:{line}
│   ```{lang}
│   {sanitizer_code 2-3行}
│   ```
│   可绕过: {是(原因)/否}
│
└── Sink: {file}:{line}
    ```{lang}
    {code_snippet 2-3行}
    ```
```

### Low/Info 漏洞

仅需 Sink 位置 + 简要描述，无需完整链。

---

## 引用 references/core/taint_analysis.md

对于需要完整污点分析的场景，加载详细方法论:
- Sink识别 — 分析危险函数和涉及变量
- 反向追踪 — 从Sink向上追踪数据来源
- Source定位 — 识别用户可控输入点
- 净化检查 — 验证传播路径上的安全措施
- 报告生成 — 输出完整的污点分析报告
