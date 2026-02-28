---
name: tech-stack-router
description: "Tech stack to security module routing table, tech stack identification methods, functional module discovery, and boundary interaction matrix."
---

# Tech Stack Router Skill

> 技术栈→专项路由表、技术栈识别方法、功能模块发现、边界交互矩阵

## 技术栈→专项路由表（审计前勾选）

| 信号 | 必加载模块 |
|------|-----------|
| CDN/反代/Nginx/Envoy/Traefik | `references/security/cache_host_header.md` + api_gateway_proxy |
| OIDC/SAML/JWT/JWK/kid/redirect_uri | `references/security/oauth_oidc_saml.md` + cryptography |
| WebSocket/SSE/gRPC/ActionCable/SignalR | `references/security/realtime_protocols.md` |
| CI/CD + Docker/K8s/Terraform/Helm | `references/security/infra_supply_chain.md` + dependencies |
| 长连接 + 消息队列(Kafka/RabbitMQ) | realtime_protocols + message_queue_async |
| API/REST/GraphQL | `references/security/api_security.md` + graphql |
| 反序列化/脚本引擎/JNDI/表达式 | 对应 `references/languages/*` 语言专项 |

> Phase 1 识别技术栈后立即勾选此表，确认专项模块不遗漏。

## 功能模块发现与攻击面映射

> 功能模块决定攻击面。先发现项目有哪些模块，再展开每个模块的攻击面。

### 功能域攻击面启发表

| 功能域 | 子功能 (启发) | 攻击提示 (非穷举) |
|--------|--------------|-------------------|
| **身份认证** | 登录、注册、密码重置、SSO/OAuth、MFA、Remember Me、Token刷新 | 凭据填充、JWT算法混淆、重置令牌预测/复用、OAuth重定向劫持、MFA绕过 |
| **权限控制** | RBAC/ABAC、数据隔离、资源归属、批量操作、API鉴权 | IDOR、垂直越权、组织隔离绕过、批量操作逐一校验缺失、Mass Assignment |
| **文件管理** | 上传、下载、预览、在线编辑、解压、临时文件 | 扩展名绕过、路径遍历、Zip Slip、SSRF(预览远程URL)、WebShell |
| **数据查询** | 搜索、过滤、排序、分页、导出 | SQL/NoSQL/HQL注入、ORDER BY注入、导出注入(CSV/Excel公式) |
| **支付交易** | 下单、支付、退款、优惠券、余额 | 金额篡改、竞态条件、支付回调伪造、优惠叠加、负数绕过 |
| **外部集成** | 数据源、邮件、短信、Webhook、SSO、云存储 | JDBC注入/协议攻击、SSRF、凭据泄露、Webhook回调伪造 |
| **管理后台** | 用户管理、系统配置、日志、监控、数据库管理 | 默认凭据、Actuator暴露、日志注入、SQL编辑器任意执行 |
| **插件/扩展** | 插件加载、脚本执行、自定义函数、模板 | ClassLoader劫持、表达式注入、沙箱逃逸、反序列化 |
| **任务调度** | 定时任务、异步任务、消息消费 | Cron注入、反序列化(MQ消息体)、任务参数篡改 |
| **通知/消息** | 站内信、邮件、推送、WebSocket | 存储XSS、模板注入、消息伪造、未授权订阅 |

⚠️ 以上均为启发提示，LLM 应基于项目实际代码适度扩展（每个功能域补充 1-3 项），避免无限展开。

## 边界交互矩阵

| 方向 | 边界类型 | 重点攻击 |
|------|---------|---------|
| 入站 | HTTP/API、文件上传、MQ消费、RPC、SSO回调、WebSocket | 注入、认证绕过、反序列化 |
| 出站 | HTTP请求、DB查询、SMTP、文件系统、命令执行、云API | SSRF、SQL注入、命令注入、凭据泄露 |
| 存储 | Session/Cache、数据库、文件、消息队列 | 数据篡改、二次注入、序列化攻击 |
