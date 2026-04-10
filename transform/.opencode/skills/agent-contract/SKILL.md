]---
name: agent-contract
description: "Agent contract templates for R1 and R2+ rounds, including output format, token budget management, truncation defense, and auto-injection prompt templates."
---

# Agent Contract Skill

> Agent 合约模板 — R1/R2+ 自动注入模板、输出格式、Token 预算、截断防御

## Agent 合约字段（每个 Agent 启动前必须包含）

```
[搜索路径]   Phase 1 产出的核心代码目录列表
[排除目录]   node_modules, .git, build, dist, target, test, tests, frontend
[工具约束]   搜索用 Grep（ripgrep, 1-3秒）, 文件名用 Glob, 读文件用 Read
             Bash 仅限系统命令（git, mvn, npm, docker）
[禁止写法]   Bash 中的 grep/find/cat（违反 = 10-100x 性能退化）
[调用预算]   工具总调用 ≤400 次, Bash ≤300 次, 超过 200 次开始汇总
[max_turns]  Task 工具的 max_turns 参数
[Turn预留]   turns_used ≥ max_turns - 3 时停止探索，立即产出结构化输出
[超时策略]   Bash timeout ≤30s, Grep 超时→缩小 path→连续失败 2 次→跳过
[审计策略]   sink-driven | control-driven | config-driven
[轮次目标]   Round N 的目标函数 + 方法关键词
[前轮输入]   Round N≥2 时的跨轮传递结构
[增量约束]   R2+ 禁止重读 FILES_READ 文件、重复 GREP_DONE 模式
[输出格式]   结构化摘要（见下方模板）
[截断防御]   HEADER 开头 + AGENT_OUTPUT_END 结尾
```

---

## Agent Token 预算管理

| 轮次 | Agent 类型 | 数量 | max_turns | 工具调用上限 | 说明 |
|------|-----------|------|-----------|-------------|------|
| R1 | 广度扫描 | 3-5 | 25 | 400 | Grep 定位 + 入口识别 |
| R2 | 增量补漏 | 1-3（按缺口） | 400 | 50 | 只覆盖 R1 缺口 + 数据流深度 |
| R3 | 攻击链验证 | 0-1 | 15 | 400 | 仅有跨模块候选时启动 |

**Token 节约规则**:
1. **定向读取**: Read 用 offset/limit 读取相关代码段（50-100行）
2. **Grep 先行**: 先 Grep 定位行号 → 再 Read 该行号±20行上下文
3. **提前终止**: 同一维度发现 ≥5 个同类漏洞时合并
4. **合并同类**: 同 pattern 多文件 → 1 个发现 + 受影响文件列表

---

## Agent 输出模板

> HEADER 段放在最前部，即使 findings 被截断仍可存活。

```
## Agent: {方向名称} | Round {N} | 发现: {数量}

=== HEADER START ===
COVERAGE: D1=✅(3,fan=5/12), D2=⚠️(1,fan=1/8), D3=❌, ...
  sink-driven: fan=已追踪文件数/Grep命中文件数
  control-driven(D3/D9): epr=已验证端点数/矩阵总端点数, crud_types=N
UNCHECKED: D1:[orderBy injection]: ORDER BY ${param} | ...
UNFINISHED: {描述}|{原因}, ...
STATS: tools={N}/50 | files_read={N} | grep_patterns={N} | endpoints_audited={N}/{total} | time=~{N}min
=== HEADER END ===

=== TRANSFER BLOCK START ===
FILES_READ: {file1}:{结论} | {file2}:{结论} | ...
GREP_DONE: {pattern1} | {pattern2} | ...
HOTSPOTS: {file:line:断点描述} | ...
=== TRANSFER BLOCK END ===

### 发现列表（表格格式，按严重度排序）

| # | 等级 | 漏洞标题 | 位置 | 关键证据(≤60字) | 数据流 |
|---|------|---------|------|----------------|--------|
| 1 | C | JWT无签名验证 | TokenUtils.java:14 | JWT.decode(token) 无 verify | HTTP→TokenFilter→JWT.decode→ThreadLocal |

### 发现详情（仅 Critical 和高置信 High，每条 ≤5 行）

**[C-01] JWT无签名验证**
代码: `JWT.decode(token)` 替代 `JWT.require(algo).build().verify(token)`
数据流: Request→TokenFilter.doFilter()→TokenUtils.validate()→JWT.decode()
影响: 伪造任意 uid 的 JWT 即可冒充管理员

=== AGENT_OUTPUT_END ===
```

---

## 输出预算规则

- HEADER: ≤ 400 字 + TRANSFER BLOCK: ≤ 400 字（总 800 字）
- 发现表格: 每条 1 行 ≤ 150 字，最多 20 行
- 发现详情: 仅 Critical + 高置信 High，每条 ≤ 10 行，最多 100 条
- **总输出目标: ≤ 5000 字**
- 禁止: 大段原始代码(>3行)、完整文件内容、冗长修复建议

---

## 自动注入模板 — R1

```
---Agent Contract---
1. 搜索路径（搜索前先使用Grep工具确认文件完整路径，再使用Read工具读取）: {paths}。排除: {excludes}。
2. 必须使用 Grep/Glob/Read 工具。禁止 Bash 中 grep/find/cat。
3. 40 ≤ 工具调用 ≤ 400 次，Bash ≤ 300 次。max_turns: {N}。
   ★ Turn 预留: turns_used ≥ max_turns-3 时立即停止探索，产出结构化输出。
4. Bash timeout: 30000。Grep 超时→缩小 path→失败 2 次→跳过。
5. 搜索策略: Grep 定位行号 → Read offset/limit 读上下文。禁止整文件读取。
6. 输出: 按 Agent 输出模板返回。禁止大段代码（>5行）。
7. 节约: 同类漏洞 ≥5 合并，只详细描述其中一个漏洞的细节。同 pattern 多文件列清单。
8. 同维度多入口:
   a. Sink 类别枚举: ≥1 入口后一次性枚举剩余类别。
   b. 类别上界: 每维度最多 20 个。
   c. 实例采样: 每类别最多深度追踪 5 个。
   d. 禁止再生: UNCHECKED_CANDIDATES 只枚举一次。
   e. 格式: UNCHECKED_CANDIDATES: [{sink_type}: {grep_pattern}, ...] (最多 20 项)
9. 数据转换管道追踪:
   a. Sink → Grep 调用位置 → 追踪中间构造/转换层
   b. 重复直到 Source 或 5 层上限，每层 Read 验证
   c. 中间层无清洗 → 标记为独立注入入口
10. ★ 截断防御:
    a. 输出以 === HEADER START === 开头
    b. HEADER ≤400 字 + TRANSFER BLOCK ≤400 字
    c. 发现用表格，详情仅 Critical + 高置信 High
    d. 总输出 ≤5000 字
    e. 末尾 === AGENT_OUTPUT_END ===
---End Contract---
```

---

## 自动注入模板 — R2+

```
---Agent Contract (R2+)---
1-7. [与 R1 相同的基础合约，含 Turn 预留规则]
7.5 数据转换管道追踪: 同 R1 #9。优先追踪 HOTSPOTS 中间转换层。
8. 前轮传递:
   COVERED: {dimensions}
   GAPS: {dimensions} ← 审计目标
   CLEAN: {patterns} ← 直接跳过
   HOTSPOTS: {file:line:断点描述} ← 优先深入
   FILES_READ: {file:conclusion} ← 不再重读
   GREP_DONE: {pattern} ← 不再重复
9. 增量规则: 只审计 GAPS。CLEAN 不搜索。FILES_READ 不重读。
10. 收敛规则: R2+ 禁止输出 UNCHECKED_CANDIDATES。候选链深度=1。
11. ★ 截断防御: 同 R1 #10。
---End Contract---
```
