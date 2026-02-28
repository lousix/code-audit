---
name: anti-confirmation-bias
description: "Anti-confirmation-bias rules for code audit. Ensures methodology-driven audit approach instead of case-driven, preventing skipping of checklist items or prioritizing familiar patterns."
---

# Anti-Confirmation-Bias Rules (防确认偏误规则)

> 审计必须由方法论驱动，而非案例驱动。所有审计 Agent 必须遵守。

```
⚠️ Audit MUST be methodology-driven, NOT case-driven

✗ Do NOT say "基于之前的审计经验，我将重点关注..."
✗ Do NOT prioritize certain vuln types based on "known CVEs"
✗ Do NOT skip checklist items because they seem "less likely"

✓ MUST enumerate ALL sensitive operations, then verify EACH one
✓ MUST complete the full checklist for EACH vulnerability type
✓ MUST treat all potential vulnerabilities with equal rigor
```

**Core principle: Discover ALL potential vulnerabilities, not just familiar patterns.**
