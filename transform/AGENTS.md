# Code Audit — Project Instructions

> 专业代码安全审计系统 | Professional Code Security Audit System
> 支持模式: quick / quick-diff / standard / deep
> 支持语言: Java, Python, Go, PHP, JavaScript/Node.js, C/C++, .NET/C#, Ruby, Rust
> 版本: 1.0 | 更新: 2026-02-13

---

## System Architecture Overview

本系统采用 **Dispatcher + Subagent + Skill** 三层架构，实现多维度并行代码安全审计。

```
┌─────────────────────────────────────────────────────────────┐
│              code-audit (Dispatcher / Primary Agent)          │
│  职责: 模式判定 → 文档加载 → 侦察 → 执行计划 → Agent调度     │
└──────────────────────────┬──────────────────────────────────┘
                           │ dispatch
        ┌──────────┬───────┼───────┬──────────┬──────────┐
        ▼          ▼       ▼       ▼          ▼          ▼
   audit-recon  audit-d1  d2d3d9  d4-rce  d5d6-file  d7d8d10
   (侦察)      (注入)   (控制)  (RCE)   (文件/SSRF) (配置)
        │                                              │
        └──────────────────────────────────────────────┘
                           │
                    audit-evaluation → audit-report
```

- **Agent 定义**: `.opencode/agents/` — 包含 code-audit (主调度器) 及 9 个专业 Subagent
- **Skill 知识库**: `.opencode/skills/` — 可复用的方法论模块 (anti-hallucination, anti-confirmation-bias, attack-chain, taint-analysis 等)
- **参考文档**: `references/` — 核心方法论、语言模块、框架模块、安全领域、Checklist、WooYun案例库

---

## Core Modules Reference (核心模块参考)

| 模块 | 路径 | 功能 |
|------|------|------|
| **防幻觉规则** | `references/core/anti_hallucination.md` | **文件验证、代码真实性、防止误报** |
| **全面审计方法论** | `references/core/comprehensive_audit_methodology.md` | **LSP攻击面映射**、系统性框架、覆盖率追踪 |
| **污点分析** | `references/core/taint_analysis.md` | 追踪算法、**LSP增强追踪**、Slot类型分类、净化后拼接检测 |
| Sink/Source参考 | `references/core/sinks_sources.md` | 完整的Source/Sink定义库 |
| **语义搜索指南** | `references/core/semantic_search_guide.md` | **漏洞语义查询、LSP精确追踪、混合搜索** |
| **安全指标库** | `references/core/security_indicators.md` | **多语言安全模式、风险分级、grep命令** |
| **PoC生成指南** | `references/core/poc_generation.md` | **各类漏洞PoC模板、验证方法、无害化测试** |
| **外部工具集成** | `references/core/external_tools_guide.md` | **Semgrep/Bandit/Gosec/Gitleaks详细集成** |
| **漏洞验证方法论** | `references/core/verification_methodology.md` | **LSP可达性分析**、条件分析、置信度评分 |
| 系统性反思 | `references/core/systematic_reflection.md` | 审计盲区分析、改进方案 |
| 误报过滤 | `references/core/false_positive_filter.md` | 降低误报率的方法 |
| 攻击路径优先级 | `references/core/attack_path_priority.md` | 攻击链优先级排序 |
| **回归测试基准** | `references/core/benchmark_methodology.md` | **漏报率测量、能力基线、冒烟测试** |
| **Capability Baseline** | `references/core/capability_baseline.md` | **防止能力丢失的回归测试框架** |

---

## Language Modules (语言模块)

| 语言 | 模块路径 | 适用范围 |
|------|----------|----------|
| Python | `references/languages/python.md` | Python, Flask |
| **Python反序列化** | `references/languages/python_deserialization.md` | **Pickle/PyYAML/jsonpickle深度** |
| Java | `references/languages/java.md` | Java, Spring Boot, Struts |
| Java Fastjson | `references/languages/java_fastjson.md` | Fastjson全版本漏洞分析 |
| **Java反序列化** | `references/languages/java_deserialization.md` | **ObjectInputStream、XStream、入口检测** |
| Java Gadget Chains | `references/languages/java_gadget_chains.md` | 107+ CC/CB/ROME等反序列化链 |
| Java JNDI注入 | `references/languages/java_jndi_injection.md` | JNDI注入、RMI/LDAP远程加载 |
| Java XXE | `references/languages/java_xxe.md` | XXE漏洞专项、XML解析器安全 |
| **Java脚本引擎RCE** | `references/languages/java_script_engines.md` | **Text4Shell/SnakeYAML/GroovyShell/JSR-223/OGNL** |
| **Java实战** | `references/languages/java_practical.md` | 若依审计案例、实战检测规则 |
| Go | `references/languages/go.md` | Go, Gin, Echo, Fiber |
| **Go安全深度** | `references/languages/go_security.md` | **并发竞态、unsafe包、cgo边界** |
| PHP | `references/languages/php.md` | PHP, Laravel, WordPress |
| **PHP反序列化** | `references/languages/php_deserialization.md` | **POP链、Phar反序列化、框架Gadget** |
| C/C++ | `references/languages/c_cpp.md` | C, C++, 嵌入式系统 |
| JavaScript | `references/languages/javascript.md` | JavaScript, Node.js, TypeScript |

---

## Framework Modules (框架模块)

| 框架 | 模块路径 | 适用范围 |
|------|----------|----------|
| FastAPI | `references/frameworks/fastapi.md` | FastAPI, Starlette |
| Django | `references/frameworks/django.md` | Django, DRF |
| **Flask** | `references/frameworks/flask.md` | **Flask, Jinja2 SSTI, DEBUG RCE** |
| Express | `references/frameworks/express.md` | Express.js, Node.js |
| Koa | `references/frameworks/koa.md` | Koa.js, Koa-Router |
| **Gin** | `references/frameworks/gin.md` | **Gin, Go Web, SQL注入, CORS** |
| Spring Boot | `references/frameworks/spring.md` | Spring Boot, MVC, Security, RuoYi实战 |
| Java Web框架 | `references/frameworks/java_web_framework.md` | Shiro、框架安全特性 |
| **MyBatis注入** | `references/frameworks/mybatis_security.md` | **${}注入、动态SQL、Provider拼接、MyBatis-Plus** |
| Laravel | `references/frameworks/laravel.md` | Laravel, Eloquent ORM |
| .NET | `references/frameworks/dotnet.md` | ASP.NET Core, Blazor |
| Nest/Fastify | `references/frameworks/nest_fastify.md` | NestJS, Fastify Node框架 |
| Rails | `references/frameworks/rails.md` | Ruby on Rails |
| Rust Web | `references/frameworks/rust_web.md` | Actix, Axum, Rocket |

---

## Security Domain Modules (安全领域模块)

> 所有安全领域模块位于 `references/security/` 目录

**架构与协议**: cross_service_trust | api_gateway_proxy | message_queue_async | graphql | realtime_protocols | http_smuggling
**应用安全**: file_operations | scheduled_tasks | business_logic | race_conditions | dependencies | memory_native
**认证与加密**: oauth_oidc_saml | cryptography | cache_host_header | api_security
**现代安全**: llm_security | serverless | infra_supply_chain
**移动安全**: `references/mobile/android.md`
**案例库**: `references/cases/real_world_vulns.md`

---

## WooYun 案例库

88,636 真实漏洞案例 (2010-2016)，来源于 WooYun 漏洞数据库。

- **索引**: `references/wooyun/INDEX.md`
- **分类**:

| 类别 | 路径 |
|------|------|
| SQL Injection | `references/wooyun/sql-injection.md` |
| XSS | `references/wooyun/xss.md` |
| Command Execution | `references/wooyun/command-execution.md` |
| File Upload | `references/wooyun/file-upload.md` |
| File Traversal | `references/wooyun/file-traversal.md` |
| Unauthorized Access | `references/wooyun/unauthorized-access.md` |
| Logic Flaws | `references/wooyun/logic-flaws.md` |
| Info Disclosure | `references/wooyun/info-disclosure.md` |

---

## Tool Priority Strategy (工具优先级策略)

```
Priority 1: External Professional Tools (if available)
├─ semgrep scan --config auto          # Multi-language SAST
├─ bandit -r ./src                      # Python security
├─ gosec ./...                          # Go security
└─ gitleaks detect                      # Secret scanning

Priority 2: Built-in Analysis (always available)
├─ LSP semantic analysis                # goToDefinition, findReferences, incomingCalls
├─ Read + Grep pattern matching         # Core analysis
└─ Module knowledge base                # 55+ vuln patterns

Priority 3: Verification
├─ PoC templates from references/core/poc_generation.md
└─ Confidence scoring from references/core/verification_methodology.md
```

---

## Tool Usage Principles (工具使用原则)

**Grep用于面**(快速定位) → **Read用于线**(数据流追踪) → **逻辑推理用于点**(漏洞确认) → **Task/Agent用于并行加速**

### 核心工具 (Core Tools — read-only, default)

```
文件读取与搜索:
- Read: 源代码、配置文件、CI/CD配置、IaC文件
- Glob: 按模式批量搜索文件 (*.py, *.js, *.java, *.xml, *.yml, Dockerfile, *.tf)
- Grep: 基于正则的危险模式和敏感信息搜索
```

### 代码修复工具 (Code Fix Tools — write, only with explicit user authorization)

```
修复工具:
- Edit: 应用安全补丁、修复已识别的漏洞
  前置条件:
  1. 用户明确请求 "修复"、"打补丁"、"生成修复代码"
  2. 清楚说明要修改的文件和内容
  3. 提醒用户备份或确认版本控制
```

### 错误恢复指导 (Error Recovery)

| 错误类型 | 处理策略 |
|---------|---------|
| 文件不存在 | Glob 确认正确路径 → 检查拼写 → 跳过继续 |
| 文件过大 | Read 指定行范围 → Grep 先定位 → 分块读取 |
| 工具不可用 | 使用替代工具 → 记录不可用情况 → 继续分析 |
| Grep 超时 | 缩小 path → 简化正则 → 限定文件类型 → 禁止回退 Bash grep |
| 重复失败 | 连续3次失败 → 换参数/方法 → 跳过 → 记录原因 |

### 循环检测

Never retry the same failed operation. Max 3 attempts per file. Proceed to report when sufficient findings exist.

### 检测命令参考

> 完整检测命令: `references/core/security_indicators.md`
> 语言专项: `references/checklists/{language}.md` D1 section
> 框架专项: `references/frameworks/{framework}.md` (if available)
> **规则**: 必须使用 Grep 工具，禁止 Bash grep。LLM 根据项目技术栈构建搜索模式。

---

## Docker Deployment Verification (Docker 部署验证)

```bash
# 生成验证环境
code-audit --generate-docker-env

# 启动并验证
docker-compose up -d
docker exec -it sandbox python /workspace/poc/verify_all.py
```

详见: `references/core/docker_verification.md`

---

## Taint Analysis Trigger (污点分析触发)

当给定漏洞位置 (file:line) 时，自动加载污点分析模块，执行以下 5 步流程:

1. **Sink 识别** — 分析危险函数及涉及的变量
2. **反向追踪** — 从 Sink 向上追溯数据来源
3. **Source 定位** — 识别用户可控的输入点
4. **净化检查** — 验证传播路径上的安全措施
5. **报告生成** — 输出完整的污点分析报告

---

## Version

- **Current**: 1.0
- **Updated**: 2026-02-13

### v1.0 (Initial Public Release)
- 9语言143项强制检测清单 (`references/checklists/`)
- 双轨并行审计框架: Sink-driven + Control-driven + Config-driven
- Docker部署验证框架 (`references/core/docker_verification.md`)
- WooYun 88,636案例库集成
- 安全控制矩阵框架
- OpenCode 调度器+Subagent+Skill 架构重构
