---
name: taint-analysis
description: "Taint analysis methodology for code audit. Provides sink identification, backward tracing, source location, sanitization checking, and report generation. Load when analyzing data flow vulnerabilities."
---

# Taint Analysis Methodology (污点分析方法论)

## 污点分析触发

当给定漏洞位置 (file:line) 时，执行以下污点分析流程：

1. **Sink识别** - 分析危险函数和涉及变量
2. **反向追踪** - 从Sink向上追踪数据来源
3. **Source定位** - 识别用户可控输入点
4. **净化检查** - 验证传播路径上的安全措施
5. **报告生成** - 输出完整的污点分析报告

## 数据流模型

```
Source → [Transform₁ → Transform₂ → ... → Transformₙ] → Sink
```

### 追踪操作

对每个 Sink:
1. Grep 调用位置 → 找到直接调用者
2. 对调用者 Grep 输入来源 → 找到中间转换层
3. 重复直到找到外部输入(Source) 或到达 3 层上限
4. 每层用 Read offset/limit 验证实际代码

### 中间层识别

典型中间层命名模式: `*Builder`, `*Provider`, `*Manager`, `*Utils`, `*Helper`, `*Handler`, `*Str*`, `*Trans*`, `*Process*`, `*Assemble*`, `*Render*`, `*Compile*`

中间转换层若接受外部参数但无清洗/参数化 → 标记为独立注入入口。

## 深度参考

完整污点分析方法论见: `references/core/taint_analysis.md` (使用 Read 工具加载)
Sink/Source 完整定义库: `references/core/sinks_sources.md`
LSP增强追踪指南: `references/core/semantic_search_guide.md`
