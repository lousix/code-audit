---
name: anti-hallucination
description: "Anti-hallucination rules for code security audit. Prevents false positive vulnerability reports by enforcing file verification, code authenticity, and tech stack matching. Must be loaded by all audit agents."
---

# Anti-Hallucination Rules (防幻觉规则)

> 文件验证机制，大幅减少误报。所有审计 Agent 必须遵守。

## 核心规则 (MUST FOLLOW)

```
⚠️ Every finding MUST be based on actual code read via tools

✗ Do NOT guess file paths based on "typical project structure"
✗ Do NOT fabricate code snippets from memory
✗ Do NOT report vulnerabilities in files you haven't read

✓ MUST use Read/Glob to verify file exists before reporting
✓ MUST quote actual code from Read tool output
✓ MUST match project's actual tech stack
```

**Core principle: Better to miss a vulnerability than report a false positive.**

## 详细规则

```
⚠️ 严禁幻觉行为 - 违反此规则的发现将被视为无效

1. 先验证文件存在，再报告漏洞
   ✗ 禁止基于"典型项目结构"猜测文件路径
   ✗ 禁止假设 config/database.py、app/api.py 等文件存在
   ✓ 必须使用 Read/Glob 工具确认文件存在后才能报告

2. 引用真实代码
   ✗ 禁止凭记忆或推测编造代码片段
   ✗ 禁止编造行号
   ✓ code_snippet 必须来自 Read 工具的实际输出
   ✓ 行号必须在文件实际行数范围内

3. 匹配项目技术栈
   ✗ Rust 项目不会有 .py 文件
   ✗ 前端项目不会有后端数据库配置
   ✓ 仔细观察识别到的技术栈信息

4. 知识库 ≠ 项目代码
   ✗ 知识库中的代码示例是通用示例，不是目标项目的代码
   ✗ 不要因为知识库说"这种模式常见"就假设项目中存在
   ✓ 必须在实际代码中验证后才能报告漏洞
```

**错误示例 (幻觉来源)**:
```
1. 查询 auth_bypass 知识 → 看到 JWT 示例
2. 没有在项目中找到 JWT 代码
3. 仍然报告 "JWT 认证绕过漏洞"  ← 这是幻觉！
```

**正确示例**:
```
1. 查询 auth_bypass 知识 → 了解认证绕过的概念
2. 使用 Read 工具读取项目的认证代码
3. 只有**实际看到**有问题的代码才报告漏洞
4. file_path 必须是你**实际读取过**的文件
```

**核心原则: 宁可漏报，不可误报。质量优于数量。**

## 深度参考

完整防幻觉方法论见: `references/core/anti_hallucination.md` (使用 Read 工具加载)
