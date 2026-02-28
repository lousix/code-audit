---
name: coverage-matrix
description: "Two-layer checklist architecture with D1-D10 security coverage matrix and language-specific semantic prompts for gap verification after free audit."
---

# Two-Layer Checklist Architecture (两层检查清单架构)

> **核心原则**: Checklist 不驱动审计，而是验证覆盖。LLM 先自由审计(Phase 2A)，再用矩阵查漏(Phase 2B)。

## Layer 1: 覆盖率矩阵 (Phase 2B 加载)

**加载时机**: Phase 2A（LLM自由审计）完成后
**作用**: 对照 10 个安全维度 (D1-D10)，标记已覆盖/未覆盖

| # | 维度 | 关键问题 | 已覆盖? | 发现数 |
|---|------|---------|---------|--------|
| D1 | 注入 | 用户输入是否能到达 SQL/Cmd/LDAP/SSTI/SpEL 执行点？ | [ ] | |
| D2 | 认证 | Token/Session 生成、验证、过期是否完整？密钥是否安全？ | [ ] | |
| D3 | 授权 | 每个敏感操作是否验证用户归属？CRUD 权限是否一致？ | [ ] | |
| D4 | 反序列化 | 是否存在不受信数据的反序列化？Gadget 链是否可达？ | [ ] | |
| D5 | 文件操作 | 上传/下载/读取路径是否可控？是否有路径遍历？ | [ ] | |
| D6 | SSRF | 服务端 HTTP 请求的 URL 是否用户可控？协议是否限制？ | [ ] | |
| D7 | 加密 | 硬编码密钥/IV？ECB/CBC-no-MAC？弱KDF？RSA-PKCS1v1.5？证书校验绕过？ | [ ] | |
| D8 | 配置 | 调试接口(Actuator/pprof)是否暴露？CORS 是否过宽？错误堆栈是否泄露？ | [ ] | |
| D9 | 业务逻辑 | 竞态条件？支付金额可篡改？流程可跳过？Mass Assignment？IDOR/水平越权？CRUD 权限注解完整性？数据导出范围？ | [ ] | |
| D10 | 供应链 | 依赖是否有已知 CVE？版本是否在安全范围？ | [ ] | |

### 使用规则

- **未覆盖维度** → 加载 `references/checklists/{language}.md` 中对应 `## D{N}` 段落的语义提示，补充审计
- **Critical 维度** (D1-D6) 必须全部覆盖
- **High 维度** (D7-D8) 强烈建议覆盖
- **High 维度** (D9) 有后台管理/多角色/多租户/支付逻辑的项目必查
- **Medium 维度** (D10) 按项目类型可选（有外部依赖则 D10 必查）

---

## Layer 2: 语义提示 (按需加载未覆盖维度)

| 主语言 | 语义提示文件 |
|--------|-------------|
| Java | `references/checklists/java.md` |
| Python | `references/checklists/python.md` |
| PHP | `references/checklists/php.md` |
| JavaScript/Node.js | `references/checklists/javascript.md` |
| Go | `references/checklists/go.md` |
| .NET/C# | `references/checklists/dotnet.md` |
| Ruby | `references/checklists/ruby.md` |
| C/C++ | `references/checklists/c_cpp.md` |
| Rust | `references/checklists/rust.md` |

通用维度: `references/checklists/universal.md` (架构/逻辑级)

---

## 加载指令

1. **Phase 2A 期间禁止加载 checklist**。LLM 使用自身安全知识自由审计。
2. Phase 2A 完成后，加载 `coverage_matrix.md`，标记已覆盖维度。
3. 对未覆盖维度，加载 `{language}.md` 中对应 `## D{N}` 段落（按需加载，非全量）。
4. 语义提示仅提供关键问题和判定规则，LLM 自行决定搜索策略。

**依赖感知裁剪**: 读取 pom.xml/package.json/go.mod 后，D10(供应链)维度中不存在的依赖标记SKIP。

---

## 覆盖标准（按审计策略分轨）

### Sink-driven 维度 (D1/D4/D5/D6)
- ✅已覆盖 = 核心 Sink 类别均被搜索 + 有数据流追踪 + Sink 扇出率 ≥ 30%
- ⚠️浅覆盖 = 搜索过但 Sink 类别有遗漏 / 仅 Grep 未追踪 / 扇出率 < 30%
- ❌未覆盖 = 未被任何 Agent 搜索

### Control-driven 维度 (D3/D9)
- ✅已覆盖 = 端点审计率 ≥ 50%(deep)/30%(standard) + ≥3种资源类型CRUD对比 + IDOR覆盖
- ⚠️浅覆盖 = 仅 Grep pattern 未系统枚举
- ❌未覆盖 = 未执行 Control-driven 审计

### Config-driven 维度 (D2/D7/D8/D10)
- ✅已覆盖 = 核心配置项均已检查 + 版本/算法已对比基线
- ⚠️浅覆盖 = 仅检查了部分配置
- ❌未覆盖 = 未检查

### T3 Sink 覆盖验证
对每个标记 ✅ 的维度，检查核心 Sink 类别是否都被搜索过。如有遗漏 → 降级 ⚠️。

### 强制覆盖
D1(注入) + D2(认证) + D3(授权) 必须覆盖，否则不可进入 REPORT。
