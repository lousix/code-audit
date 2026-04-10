import { tool } from "@opencode-ai/plugin";
import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join, dirname } from "path";
import { mkdirSync, existsSync, writeFileSync } from "fs";

// DB stored at ~/.opencode/audit.db — shared across all projects
const DB_PATH = join(homedir(), ".opencode", "audit.db");

function getDb() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    path       TEXT,
    language   TEXT,
    framework  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_sessions (
    id          INTEGER PRIMARY KEY,
    project_id  INTEGER REFERENCES projects(id),
    mode        TEXT,
    rounds      INTEGER DEFAULT 1,
    status      TEXT DEFAULT 'running',
    started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    notes       TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS findings (
    id             INTEGER PRIMARY KEY,
    session_id     INTEGER REFERENCES audit_sessions(id),
    vuln_id        TEXT,
    title          TEXT NOT NULL,
    severity       TEXT,
    cvss_score     REAL,
    cwe            TEXT,
    confidence     TEXT,
    file_path      TEXT,
    line_number    INTEGER,
    vuln_type      TEXT,
    description    TEXT,
    vuln_code      TEXT,
    attack_vector  TEXT,
    poc            TEXT,
    fix_suggestion TEXT,
    agent_source   TEXT,
    round_number   INTEGER DEFAULT 1,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sink_chains (
    id           INTEGER PRIMARY KEY,
    finding_id   INTEGER REFERENCES findings(id),
    step_order   INTEGER,
    step_type    TEXT,
    file_path    TEXT,
    line_number  INTEGER,
    code_snippet TEXT,
    notes        TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attack_chains (
    id                INTEGER PRIMARY KEY,
    session_id        INTEGER REFERENCES audit_sessions(id),
    chain_title       TEXT,
    combined_severity TEXT,
    description       TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attack_chain_steps (
    chain_id   INTEGER REFERENCES attack_chains(id),
    finding_id INTEGER REFERENCES findings(id),
    step_order INTEGER,
    link_desc  TEXT
  )`);
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const auditInitSession = tool({
  description: "Initialize an audit session. Call once at the start of each audit. Returns session_id used by all other audit tools.",
  args: {
    project_name: tool.schema.string().describe("Project name (unique identifier)"),
    project_path: tool.schema.string().describe("Absolute path to the project being audited"),
    language:     tool.schema.string().optional().describe("Primary language, e.g. Python, Java, Go"),
    framework:    tool.schema.string().optional().describe("Framework, e.g. Django, Spring Boot"),
    mode:         tool.schema.string().optional().describe("Audit mode: quick | standard | deep"),
    notes:        tool.schema.string().optional().describe("Notes for this session, e.g. 'post-fix retest round 2'"),
  },
  async execute(args) {
    const db = getDb();
    // Upsert project
    db.run(
      `INSERT INTO projects (name, path, language, framework)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         path      = excluded.path,
         language  = COALESCE(excluded.language, language),
         framework = COALESCE(excluded.framework, framework)`,
      [args.project_name, args.project_path, args.language ?? null, args.framework ?? null]
    );
    const project = db.query("SELECT id FROM projects WHERE name = ?").get(args.project_name);
    // Create new session
    const result = db.run(
      `INSERT INTO audit_sessions (project_id, mode, notes) VALUES (?, ?, ?)`,
      [project.id, args.mode ?? "standard", args.notes ?? null]
    );
    db.close();
    return JSON.stringify({ session_id: result.lastInsertRowid, project_id: project.id });
  },
});

const auditSaveFinding = tool({
  description: "Save a vulnerability finding to the database immediately upon discovery. Call this as soon as a vulnerability is identified, even if confidence is low.",
  args: {
    session_id:     tool.schema.number().describe("Session ID from audit_init_session"),
    title:          tool.schema.string().describe("Short vulnerability title, e.g. 'SQL Injection in UserController.search()'"),
    severity:       tool.schema.string().describe("Critical | High | Medium | Low | Info"),
    confidence:     tool.schema.string().describe("已验证 | 高置信 | 中置信 | 需验证"),
    vuln_type:      tool.schema.string().describe("Vulnerability type, e.g. SQLi, RCE, SSRF, XSS, IDOR"),
    file_path:      tool.schema.string().describe("Relative file path, e.g. src/controllers/user.py"),
    line_number:    tool.schema.number().optional().describe("Line number of the vulnerable code"),
    description:    tool.schema.string().describe("Detailed description of the vulnerability"),
    vuln_code:      tool.schema.string().optional().describe("The vulnerable code snippet"),
    attack_vector:  tool.schema.string().optional().describe("How an attacker would exploit this"),
    poc:            tool.schema.string().optional().describe("Proof of concept payload or steps"),
    fix_suggestion: tool.schema.string().optional().describe("Concrete fix recommendation"),
    agent_source:   tool.schema.string().optional().describe("Which agent found this, e.g. audit-d1-injection"),
    round_number:   tool.schema.number().optional().describe("Audit round number (default 1)"),
    cvss_score:     tool.schema.number().optional().describe("CVSS score 0.0-10.0"),
    cwe:            tool.schema.string().optional().describe("CWE identifier, e.g. CWE-89"),
  },
  async execute(args) {
    const db = getDb();
    const result = db.run(
      `INSERT INTO findings
         (session_id, title, severity, confidence, vuln_type, file_path, line_number,
          description, vuln_code, attack_vector, poc, fix_suggestion,
          agent_source, round_number, cvss_score, cwe)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        args.session_id, args.title, args.severity, args.confidence,
        args.vuln_type, args.file_path, args.line_number ?? null,
        args.description, args.vuln_code ?? null, args.attack_vector ?? null,
        args.poc ?? null, args.fix_suggestion ?? null,
        args.agent_source ?? null, args.round_number ?? 1,
        args.cvss_score ?? null, args.cwe ?? null,
      ]
    );
    db.close();
    return JSON.stringify({ finding_id: result.lastInsertRowid });
  },
});

const auditSaveSinkChain = tool({
  description: "Save sink chain nodes for a finding. Call after audit_save_finding with the finding_id. Pass steps as a JSON array.",
  args: {
    finding_id: tool.schema.number().describe("Finding ID from audit_save_finding"),
    steps: tool.schema.string().describe(
      'JSON array of sink chain steps. Each step: {"step_type":"Source|Transform|Sanitizer|Sink","file_path":"...","line_number":42,"code_snippet":"...","notes":"..."}'
    ),
  },
  async execute(args) {
    const db = getDb();
    let steps;
    try {
      steps = JSON.parse(args.steps);
    } catch {
      return JSON.stringify({ error: "steps must be a valid JSON array" });
    }
    const insert = db.prepare(
      `INSERT INTO sink_chains (finding_id, step_order, step_type, file_path, line_number, code_snippet, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      insert.run([args.finding_id, i, s.step_type ?? null, s.file_path ?? null,
                  s.line_number ?? null, s.code_snippet ?? null, s.notes ?? null]);
    }
    db.close();
    return JSON.stringify({ saved: steps.length });
  },
});

const auditSaveAttackChain = tool({
  description: "Save a multi-finding attack chain (e.g. auth bypass → RCE). finding_ids and link_descs are comma-separated, ordered by chain step.",
  args: {
    session_id:        tool.schema.number().describe("Session ID"),
    chain_title:       tool.schema.string().describe("Attack chain title, e.g. 'Auth Bypass → RCE'"),
    combined_severity: tool.schema.string().describe("Combined severity: Critical | High | Medium"),
    description:       tool.schema.string().describe("Full description of the attack chain"),
    finding_ids:       tool.schema.string().describe("Comma-separated finding IDs in chain order, e.g. '3,7,12'"),
    link_descs:        tool.schema.string().optional().describe("Comma-separated descriptions of how each step enables the next"),
  },
  async execute(args) {
    const db = getDb();
    const chainResult = db.run(
      `INSERT INTO attack_chains (session_id, chain_title, combined_severity, description)
       VALUES (?, ?, ?, ?)`,
      [args.session_id, args.chain_title, args.combined_severity, args.description]
    );
    const chainId = chainResult.lastInsertRowid;
    const ids = args.finding_ids.split(",").map(s => parseInt(s.trim(), 10));
    const descs = args.link_descs ? args.link_descs.split(",") : [];
    const insertStep = db.prepare(
      `INSERT INTO attack_chain_steps (chain_id, finding_id, step_order, link_desc) VALUES (?, ?, ?, ?)`
    );
    for (let i = 0; i < ids.length; i++) {
      insertStep.run([chainId, ids[i], i, descs[i]?.trim() ?? null]);
    }
    db.close();
    return JSON.stringify({ chain_id: chainId });
  },
});

const auditCompleteSession = tool({
  description: "Mark an audit session as completed.",
  args: {
    session_id: tool.schema.number().describe("Session ID to mark as completed"),
  },
  async execute(args) {
    const db = getDb();
    db.run(
      `UPDATE audit_sessions SET status='completed', finished_at=CURRENT_TIMESTAMP WHERE id=?`,
      [args.session_id]
    );
    db.close();
    return JSON.stringify({ ok: true });
  },
});

const auditListSessions = tool({
  description: "List audit sessions, optionally filtered by project name. Useful to find session_id for report generation.",
  args: {
    project_name: tool.schema.string().optional().describe("Filter by project name (partial match)"),
  },
  async execute(args) {
    const db = getDb();
    let rows;
    if (args.project_name) {
      rows = db.query(
        `SELECT s.id, p.name as project, s.mode, s.status, s.rounds, s.started_at, s.notes
         FROM audit_sessions s JOIN projects p ON p.id=s.project_id
         WHERE p.name LIKE ?
         ORDER BY s.id DESC LIMIT 50`
      ).all(`%${args.project_name}%`);
    } else {
      rows = db.query(
        `SELECT s.id, p.name as project, s.mode, s.status, s.rounds, s.started_at, s.notes
         FROM audit_sessions s JOIN projects p ON p.id=s.project_id
         ORDER BY s.id DESC LIMIT 50`
      ).all();
    }
    db.close();
    if (!rows.length) return "No sessions found.";
    const header = "id | project | mode | status | started_at | notes";
    const sep = "-".repeat(80);
    const lines = rows.map(r =>
      `${r.id} | ${r.project} | ${r.mode} | ${r.status} | ${r.started_at} | ${r.notes ?? ""}`
    );
    return [header, sep, ...lines].join("\n");
  },
});

// ─── Report generation helpers ───────────────────────────────────────────────

const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info"];

function severityBadge(s) {
  const colors = { Critical: "#d32f2f", High: "#f57c00", Medium: "#fbc02d", Low: "#388e3c", Info: "#1976d2" };
  return `<span style="background:${colors[s]??'#888'};color:#fff;padding:2px 8px;border-radius:3px;font-size:0.85em;font-weight:bold">${s}</span>`;
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function buildSinkChainMd(steps) {
  if (!steps.length) return "";
  const lines = steps.map((s, i) => {
    const prefix = i === steps.length - 1 ? "└──" : "├──";
    const loc = s.file_path ? `${s.file_path}${s.line_number ? `:${s.line_number}` : ""}` : "";
    const code = s.code_snippet ? ` | \`${s.code_snippet.replace(/\n/g," ").slice(0,120)}\`` : "";
    const note = s.notes ? ` | ${s.notes}` : "";
    return `${prefix} ${s.step_type}: ${loc}${code}${note}`;
  });
  const chain = steps.map(s => s.step_type).join(" → ");
  return `\`\`\`\n[SINK-CHAIN] ${chain}\n${lines.join("\n")}\n\`\`\``;
}

function buildSinkChainHtml(steps) {
  if (!steps.length) return "";
  const chain = steps.map(s => escapeHtml(s.step_type)).join(" → ");
  const rows = steps.map((s, i) => {
    const prefix = i === steps.length - 1 ? "└──" : "├──";
    const loc = s.file_path ? `<code>${escapeHtml(s.file_path)}${s.line_number ? `:${s.line_number}` : ""}</code>` : "";
    const code = s.code_snippet ? `<pre style="margin:4px 0;font-size:0.8em;background:#1e1e1e;color:#d4d4d4;padding:4px 8px;border-radius:3px;overflow-x:auto">${escapeHtml(s.code_snippet)}</pre>` : "";
    const note = s.notes ? `<em style="color:#888;font-size:0.85em">${escapeHtml(s.notes)}</em>` : "";
    return `<div style="margin:2px 0">${prefix} <strong>${escapeHtml(s.step_type)}</strong>: ${loc}${code}${note}</div>`;
  });
  return `<div style="background:#f5f5f5;border-left:3px solid #888;padding:8px 12px;font-family:monospace;font-size:0.9em;margin:8px 0">
    <div style="color:#555;margin-bottom:6px">[SINK-CHAIN] ${chain}</div>
    ${rows.join("\n")}
  </div>`;
}

function generateMarkdown(session, project, findings, sinkMap, attackChains, chainSteps) {
  const date = new Date().toISOString().slice(0, 10);
  const counts = {};
  for (const s of SEVERITY_ORDER) counts[s] = findings.filter(f => f.severity === s).length;

  let md = `# 安全审计报告\n\n`;
  md += `**项目**: ${project.name}  \n`;
  md += `**路径**: ${project.path ?? "-"}  \n`;
  md += `**技术栈**: ${[project.language, project.framework].filter(Boolean).join(" / ") || "-"}  \n`;
  md += `**审计模式**: ${session.mode ?? "-"}  \n`;
  md += `**审计时间**: ${session.started_at}  \n`;
  md += `**报告生成**: ${date}  \n`;
  if (session.notes) md += `**备注**: ${session.notes}  \n`;
  md += `\n---\n\n`;

  md += `## 执行摘要\n\n`;
  md += `| 等级 | 数量 |\n|------|------|\n`;
  for (const s of SEVERITY_ORDER) md += `| ${s} | ${counts[s]} |\n`;
  md += `| **合计** | **${findings.length}** |\n\n`;

  // Assign vuln IDs
  const prefixMap = { Critical: "C", High: "H", Medium: "M", Low: "L", Info: "I" };
  const idxMap = {};
  for (const f of findings) {
    const p = prefixMap[f.severity] ?? "X";
    idxMap[p] = (idxMap[p] ?? 0) + 1;
    f._vid = `${p}-${String(idxMap[p]).padStart(2, "0")}`;
  }

  md += `## 漏洞详情\n\n`;
  for (const sev of SEVERITY_ORDER) {
    const group = findings.filter(f => f.severity === sev);
    if (!group.length) continue;
    md += `### ${sev}\n\n`;
    for (const f of group) {
      md += `#### [${f._vid}] ${f.title}\n\n`;
      md += `| 属性 | 值 |\n|------|----|\n`;
      md += `| 严重程度 | ${f.severity} |\n`;
      if (f.cvss_score != null) md += `| CVSS | ${f.cvss_score} |\n`;
      if (f.cwe) md += `| CWE | ${f.cwe} |\n`;
      md += `| 置信度 | ${f.confidence ?? "-"} |\n`;
      md += `| 漏洞类型 | ${f.vuln_type ?? "-"} |\n`;
      md += `| 位置 | \`${f.file_path ?? "-"}${f.line_number ? `:${f.line_number}` : ""}\` |\n`;
      if (f.agent_source) md += `| 发现Agent | ${f.agent_source} |\n`;
      md += `\n`;
      if (f.description) md += `**描述**\n\n${f.description}\n\n`;
      if (f.vuln_code) md += `**漏洞代码**\n\n\`\`\`\n${f.vuln_code}\n\`\`\`\n\n`;
      const steps = sinkMap[f.id] ?? [];
      if (steps.length) md += `**Sink 链**\n\n${buildSinkChainMd(steps)}\n\n`;
      if (f.attack_vector) md += `**攻击向量**\n\n${f.attack_vector}\n\n`;
      if (f.poc) md += `**PoC**\n\n\`\`\`\n${f.poc}\n\`\`\`\n\n`;
      if (f.fix_suggestion) md += `**修复建议**\n\n${f.fix_suggestion}\n\n`;
      md += `---\n\n`;
    }
  }

  if (attackChains.length) {
    md += `## 攻击链分析\n\n`;
    for (const chain of attackChains) {
      md += `### ${chain.chain_title} [${chain.combined_severity}]\n\n`;
      md += `${chain.description}\n\n`;
      const steps = chainSteps.filter(s => s.chain_id === chain.id);
      if (steps.length) {
        md += `**攻击路径**:\n\n`;
        for (const s of steps) {
          const f = findings.find(x => x.id === s.finding_id);
          md += `${s.step_order + 1}. **[${f?._vid ?? s.finding_id}]** ${f?.title ?? "Unknown"}`;
          if (s.link_desc) md += ` → ${s.link_desc}`;
          md += `\n`;
        }
        md += `\n`;
      }
    }
  }

  return md;
}

function generateHtml(session, project, findings, sinkMap, attackChains, chainSteps) {
  const date = new Date().toISOString().slice(0, 10);
  const counts = {};
  for (const s of SEVERITY_ORDER) counts[s] = findings.filter(f => f.severity === s).length;

  const prefixMap = { Critical: "C", High: "H", Medium: "M", Low: "L", Info: "I" };
  const idxMap = {};
  for (const f of findings) {
    const p = prefixMap[f.severity] ?? "X";
    idxMap[p] = (idxMap[p] ?? 0) + 1;
    f._vid = `${p}-${String(idxMap[p]).padStart(2, "0")}`;
  }

  const statCards = SEVERITY_ORDER.map(s => {
    const colors = { Critical: "#d32f2f", High: "#f57c00", Medium: "#fbc02d", Low: "#388e3c", Info: "#1976d2" };
    return `<div style="background:${colors[s]};color:#fff;padding:16px 24px;border-radius:8px;text-align:center;min-width:100px">
      <div style="font-size:2em;font-weight:bold">${counts[s]}</div>
      <div style="font-size:0.9em;margin-top:4px">${s}</div>
    </div>`;
  }).join("\n");

  let findingsHtml = "";
  for (const sev of SEVERITY_ORDER) {
    const group = findings.filter(f => f.severity === sev);
    if (!group.length) continue;
    findingsHtml += `<h2 style="border-bottom:2px solid #333;padding-bottom:8px;margin-top:40px">${sev}</h2>\n`;
    for (const f of group) {
      const steps = sinkMap[f.id] ?? [];
      findingsHtml += `
      <div id="${f._vid}" style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <h3 style="margin:0 0 12px">[${f._vid}] ${escapeHtml(f.title)} ${severityBadge(f.severity)}</h3>
        <table style="border-collapse:collapse;font-size:0.9em;margin-bottom:12px">
          <tr><td style="padding:3px 12px 3px 0;color:#666;white-space:nowrap">置信度</td><td>${escapeHtml(f.confidence ?? "-")}</td></tr>
          <tr><td style="padding:3px 12px 3px 0;color:#666;white-space:nowrap">漏洞类型</td><td>${escapeHtml(f.vuln_type ?? "-")}</td></tr>
          <tr><td style="padding:3px 12px 3px 0;color:#666;white-space:nowrap">位置</td><td><code>${escapeHtml(f.file_path ?? "-")}${f.line_number ? `:${f.line_number}` : ""}</code></td></tr>
          ${f.cvss_score != null ? `<tr><td style="padding:3px 12px 3px 0;color:#666">CVSS</td><td>${f.cvss_score}</td></tr>` : ""}
          ${f.cwe ? `<tr><td style="padding:3px 12px 3px 0;color:#666">CWE</td><td>${escapeHtml(f.cwe)}</td></tr>` : ""}
          ${f.agent_source ? `<tr><td style="padding:3px 12px 3px 0;color:#666">发现Agent</td><td>${escapeHtml(f.agent_source)}</td></tr>` : ""}
        </table>
        ${f.description ? `<p style="margin:8px 0">${escapeHtml(f.description)}</p>` : ""}
        ${f.vuln_code ? `<details><summary style="cursor:pointer;color:#1976d2;margin:8px 0">漏洞代码</summary><pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;overflow-x:auto;font-size:0.85em">${escapeHtml(f.vuln_code)}</pre></details>` : ""}
        ${steps.length ? `<details open><summary style="cursor:pointer;color:#1976d2;margin:8px 0">Sink 链</summary>${buildSinkChainHtml(steps)}</details>` : ""}
        ${f.attack_vector ? `<details><summary style="cursor:pointer;color:#1976d2;margin:8px 0">攻击向量</summary><p>${escapeHtml(f.attack_vector)}</p></details>` : ""}
        ${f.poc ? `<details><summary style="cursor:pointer;color:#1976d2;margin:8px 0">PoC</summary><pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;overflow-x:auto;font-size:0.85em">${escapeHtml(f.poc)}</pre></details>` : ""}
        ${f.fix_suggestion ? `<details><summary style="cursor:pointer;color:#1976d2;margin:8px 0">修复建议</summary><p>${escapeHtml(f.fix_suggestion)}</p></details>` : ""}
      </div>`;
    }
  }

  let attackHtml = "";
  if (attackChains.length) {
    attackHtml = `<h2 style="border-bottom:2px solid #333;padding-bottom:8px;margin-top:40px">攻击链分析</h2>`;
    for (const chain of attackChains) {
      const steps = chainSteps.filter(s => s.chain_id === chain.id);
      const stepsHtml = steps.map(s => {
        const f = findings.find(x => x.id === s.finding_id);
        return `<li><strong>[${f?._vid ?? s.finding_id}]</strong> ${escapeHtml(f?.title ?? "Unknown")}${s.link_desc ? ` → <em>${escapeHtml(s.link_desc)}</em>` : ""}</li>`;
      }).join("\n");
      attackHtml += `
      <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin:16px 0">
        <h3 style="margin:0 0 8px">${escapeHtml(chain.chain_title)} ${severityBadge(chain.combined_severity)}</h3>
        <p>${escapeHtml(chain.description)}</p>
        ${steps.length ? `<ol style="margin:8px 0">${stepsHtml}</ol>` : ""}
      </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>安全审计报告 — ${escapeHtml(project.name)}</title>
  <style>
    body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; max-width:1100px; margin:0 auto; padding:24px; background:#f8f9fa; color:#212121; }
    h1 { color:#1a1a2e; } h2 { color:#16213e; } h3 { color:#0f3460; }
    code { background:#f0f0f0; padding:1px 5px; border-radius:3px; font-size:0.9em; }
    details summary:hover { opacity:0.8; }
    @media print { body { background:#fff; } }
  </style>
</head>
<body>
  <h1>安全审计报告</h1>
  <table style="font-size:0.95em;margin-bottom:24px">
    <tr><td style="padding:3px 16px 3px 0;color:#666">项目</td><td><strong>${escapeHtml(project.name)}</strong></td></tr>
    <tr><td style="color:#666">路径</td><td><code>${escapeHtml(project.path ?? "-")}</code></td></tr>
    <tr><td style="color:#666">技术栈</td><td>${escapeHtml([project.language, project.framework].filter(Boolean).join(" / ") || "-")}</td></tr>
    <tr><td style="color:#666">审计模式</td><td>${escapeHtml(session.mode ?? "-")}</td></tr>
    <tr><td style="color:#666">审计时间</td><td>${escapeHtml(session.started_at)}</td></tr>
    <tr><td style="color:#666">报告生成</td><td>${date}</td></tr>
    ${session.notes ? `<tr><td style="color:#666">备注</td><td>${escapeHtml(session.notes)}</td></tr>` : ""}
  </table>

  <h2>执行摘要</h2>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0">
    ${statCards}
    <div style="background:#37474f;color:#fff;padding:16px 24px;border-radius:8px;text-align:center;min-width:100px">
      <div style="font-size:2em;font-weight:bold">${findings.length}</div>
      <div style="font-size:0.9em;margin-top:4px">合计</div>
    </div>
  </div>

  ${findingsHtml}
  ${attackHtml}

  <footer style="margin-top:48px;padding-top:16px;border-top:1px solid #ddd;color:#888;font-size:0.85em">
    Generated by audit-db plugin · ${date}
  </footer>
</body>
</html>`;
}

const auditGenerateReport = tool({
  description: "Generate Markdown and HTML audit reports from the database for a given session. Returns the paths of the generated files.",
  args: {
    session_id: tool.schema.number().describe("Session ID to generate report for"),
    output_dir: tool.schema.string().optional().describe("Output directory for report files. Defaults to {project_path}/audit-reports/"),
  },
  async execute(args, ctx) {
    const db = getDb();

    const session = db.query("SELECT * FROM audit_sessions WHERE id=?").get(args.session_id);
    if (!session) { db.close(); return JSON.stringify({ error: `Session ${args.session_id} not found` }); }

    const project = db.query("SELECT * FROM projects WHERE id=?").get(session.project_id);

    const findings = db.query(
      `SELECT * FROM findings WHERE session_id=? ORDER BY
         CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END,
         id`
    ).all(args.session_id);

    const sinkMap = {};
    for (const f of findings) {
      sinkMap[f.id] = db.query(
        "SELECT * FROM sink_chains WHERE finding_id=? ORDER BY step_order"
      ).all(f.id);
    }

    const attackChains = db.query(
      "SELECT * FROM attack_chains WHERE session_id=? ORDER BY id"
    ).all(args.session_id);

    const chainSteps = attackChains.length
      ? db.query(
          `SELECT * FROM attack_chain_steps WHERE chain_id IN (${attackChains.map(() => "?").join(",")}) ORDER BY chain_id, step_order`
        ).all(...attackChains.map(c => c.id))
      : [];

    db.close();

    // Determine output directory
    const outDir = args.output_dir
      ?? (project.path ? join(project.path, "audit-reports") : join(ctx.directory, "audit-reports"));
    mkdirSync(outDir, { recursive: true });

    const slug = `session-${args.session_id}_${new Date().toISOString().slice(0,10)}`;
    const mdPath   = join(outDir, `${slug}.md`);
    const htmlPath = join(outDir, `${slug}.html`);

    const md   = generateMarkdown(session, project, findings, sinkMap, attackChains, chainSteps);
    const html = generateHtml(session, project, findings, sinkMap, attackChains, chainSteps);

    writeFileSync(mdPath,   md,   "utf8");
    writeFileSync(htmlPath, html, "utf8");

    return JSON.stringify({
      markdown: mdPath,
      html:     htmlPath,
      findings: findings.length,
      critical: findings.filter(f => f.severity === "Critical").length,
      high:     findings.filter(f => f.severity === "High").length,
    });
  },
});

// ─── Plugin export ────────────────────────────────────────────────────────────

export default async (_ctx) => ({
  tool: {
    audit_init_session:    auditInitSession,
    audit_save_finding:    auditSaveFinding,
    audit_save_sink_chain: auditSaveSinkChain,
    audit_save_attack_chain: auditSaveAttackChain,
    audit_complete_session: auditCompleteSession,
    audit_list_sessions:   auditListSessions,
    audit_generate_report: auditGenerateReport,
  },
});
