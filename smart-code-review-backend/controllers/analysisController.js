const Analysis = require('../models/Analysis');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_PROJECT_FILES = 400;
const MAX_EDITABLE_FILES = 6;
const MAX_PROJECT_CONTEXT_FILES = 18;
const MAX_FILE_CHARS = 12000;
const MAX_RESPONSE_CANDIDATES = 3;
const VALID_MODES = new Set(['review', 'smells', 'suggest', 'doc', 'security', 'test', 'report', 'assistant']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const REPORT_REQUIRED_SECTIONS = [
  '## Executive Summary',
  '## Project Purpose',
  '## Architecture Snapshot',
  '## Key Components',
  '## Strengths',
  '## Risks And Gaps',
  '## Recommendations',
  '## Next Steps',
];
const REPORT_MIN_LENGTH = 1800;

const SYSTEM_PROMPT = `You are an expert AI coding assistant integrated into a GitHub-connected IDE.

You have access to the user's project structure, a curated set of project files for read-only analysis, and, when provided, the full contents of editable files.

Return exactly one JSON object and nothing else. Do not wrap it in Markdown unless the model platform forces you to.

Required JSON shape:
{
  "reply": "Short conversational response for the user.",
  "needsMoreContext": false,
  "fileChanges": [
    {
      "path": "src/example.js",
      "operation": "update",
      "severity": "high",
      "summary": "What changed in one sentence.",
      "content": "THE COMPLETE UPDATED FILE CONTENT"
    }
  ]
}

Rules:
- Use "fileChanges" only when you have enough context to safely produce the complete updated contents.
- Every item in "fileChanges" must include severity: "critical", "high", "medium", or "low".
- You may only "update" an existing file if its full current contents were provided in the editable files section.
- You may "create" a new file when useful, even if it was not previously provided.
- Files provided only in the project context section are read-only context unless that same path also appears in the editable files section.
- If you need to change an existing file whose contents were not provided, set "needsMoreContext" to true, explain which file is needed, and leave "fileChanges" empty.
- Always classify findings, recommendations, and file changes by severity based on user impact and urgency.
- For project-wide reviews, prioritize concrete findings with file paths, severity, and the reason each issue matters.
- For documentation requests, you may create new Markdown files when that is the safest solution.
- Never return partial diffs or patch hunks inside "content".
- Make "reply" actionable and detailed enough to be useful. For analysis modes, prefer a structured markdown report over a short summary.
- Preserve the existing coding style when editing files.`;

async function callGroq({ systemPrompt, messages }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message || `Groq API error ${response.status}`;
    throw new Error(errMsg);
  }

  return data.choices[0].message.content;
}

function normalizeCandidateCount(value) {
  const count = Number.parseInt(value, 10);
  if (!Number.isFinite(count)) return 1;
  return Math.min(Math.max(count, 1), MAX_RESPONSE_CANDIDATES);
}

async function callGroqCandidates({ systemPrompt, messages, candidateCount = 1 }) {
  const normalizedCount = normalizeCandidateCount(candidateCount);
  if (normalizedCount === 1) {
    return [await callGroq({ systemPrompt, messages })];
  }

  return Promise.all(
    Array.from({ length: normalizedCount }, () => callGroq({ systemPrompt, messages })),
  );
}

function clampText(text, maxChars = MAX_FILE_CHARS) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n/* ...truncated for model context... */`;
}

function normalizeFilePath(filePath) {
  if (typeof filePath !== 'string') return null;

  const normalized = filePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '');

  if (!normalized) return null;
  if (normalized.split('/').some((segment) => segment === '..')) return null;

  return normalized;
}

function extractJsonCandidate(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const start = rawText.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < rawText.length; i += 1) {
    const char = rawText[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return rawText.slice(start, i + 1).trim();
    }
  }

  return null;
}

function normalizeSeverity(severity) {
  if (typeof severity !== 'string') return 'medium';

  const normalized = severity.trim().toLowerCase();
  if (VALID_SEVERITIES.has(normalized)) return normalized;

  if (normalized === 'info' || normalized === 'informational' || normalized === 'minor') {
    return 'low';
  }

  if (normalized === 'moderate' || normalized === 'normal') {
    return 'medium';
  }

  if (normalized === 'major' || normalized === 'important') {
    return 'high';
  }

  if (normalized === 'blocker' || normalized === 'urgent') {
    return 'critical';
  }

  return 'medium';
}

function extractLooseJsonReply(rawText) {
  if (typeof rawText !== 'string') return null;

  const match = rawText.match(/^\s*\{[\s\S]*"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:needsMoreContext|fileChanges)"\s*:/);
  if (!match?.[1]) return null;

  return match[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .trim();
}

function parseAssistantResponse(rawText) {
  const fallback = {
    reply: typeof rawText === 'string' && rawText.trim()
      ? rawText.trim()
      : 'I could not generate a response.',
    needsMoreContext: false,
    fileChanges: [],
  };

  const candidate = extractJsonCandidate(rawText);
  if (!candidate) return fallback;

  try {
    const parsed = JSON.parse(candidate);
    const dedupedChanges = new Map();

    if (Array.isArray(parsed.fileChanges)) {
      for (const change of parsed.fileChanges) {
        const path = normalizeFilePath(change?.path);
        const content = typeof change?.content === 'string' ? change.content : null;
        const operation = change?.operation === 'create' ? 'create' : 'update';

        if (!path || content === null) continue;

        dedupedChanges.set(path, {
          path,
          operation,
          severity: normalizeSeverity(change?.severity),
          summary: typeof change?.summary === 'string' ? change.summary.trim() : '',
          content,
        });
      }
    }

    return {
      reply: typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : fallback.reply,
      needsMoreContext: Boolean(parsed.needsMoreContext),
      fileChanges: Array.from(dedupedChanges.values()),
    };
  } catch (error) {
    const looseReply = extractLooseJsonReply(candidate);
    if (looseReply) {
      return {
        reply: looseReply,
        needsMoreContext: false,
        fileChanges: [],
      };
    }

    return fallback;
  }
}

function countMarkdownSections(text) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  return (text.match(/^##\s+/gm) || []).length;
}

function isThinReport(text) {
  if (typeof text !== 'string') return true;

  const normalized = text.trim();
  if (!normalized) return true;

  const missingSections = REPORT_REQUIRED_SECTIONS.filter((section) => !normalized.includes(section));
  const sectionCount = countMarkdownSections(normalized);

  return normalized.length < REPORT_MIN_LENGTH
    || sectionCount < 6
    || missingSections.length > 2;
}

async function expandThinReport({
  groqMessages,
  rawResult,
  parsedResult,
}) {
  const revisionPrompt = [
    'The previous project report is too thin and is not acceptable for a downloadable PDF.',
    'Rewrite it from scratch and return exactly one JSON object matching the required schema.',
    'The "reply" field must contain the complete report body itself, not a teaser, not a heading-only stub, and not a note saying the report was generated.',
    'Use all of these sections exactly:',
    ...REPORT_REQUIRED_SECTIONS,
    'Requirements:',
    '- Write substantial content under every section.',
    '- Explain the actual project based on the provided codebase context.',
    '- Mention concrete files, modules, routes, components, or services whenever possible.',
    '- Include strengths, risks, implementation gaps, and prioritized next steps.',
    '- Make it polished for stakeholders and developers.',
    '- Do not include filler such as "the report is generated below" or "suitable for export".',
    '- Keep "fileChanges" empty unless real file edits are truly needed.',
    '',
    'Previous incomplete reply:',
    parsedResult.reply || rawResult || '(empty)',
  ].join('\n');

  const revisedRawResult = await callGroq({
    systemPrompt: SYSTEM_PROMPT,
    messages: [
      ...groqMessages,
      { role: 'assistant', content: rawResult },
      { role: 'user', content: revisionPrompt },
    ],
  });

  return parseAssistantResponse(revisedRawResult);
}

function formatEditableFiles(editableFiles = []) {
  return editableFiles
    .slice(0, MAX_EDITABLE_FILES)
    .map((file) => {
      const normalizedPath = normalizeFilePath(file?.path);
      if (!normalizedPath || typeof file?.content !== 'string') return null;

      return [
        `### ${normalizedPath}`,
        `Language: ${file.language || 'text'}`,
        '```',
        clampText(file.content),
        '```',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function formatProjectContextFiles(projectContextFiles = []) {
  return projectContextFiles
    .slice(0, MAX_PROJECT_CONTEXT_FILES)
    .map((file) => {
      const normalizedPath = normalizeFilePath(file?.path);
      if (!normalizedPath || typeof file?.content !== 'string') return null;

      return [
        `### ${normalizedPath}`,
        `Language: ${file.language || 'text'}`,
        '```',
        clampText(file.content),
        '```',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function normalizeAnalysisMode(mode) {
  return VALID_MODES.has(mode) ? mode : 'assistant';
}

function buildModeInstructions(mode, scope) {
  const scopeLabel = scope === 'project' ? 'whole project' : 'active file';

  const instructions = {
    review: `Perform a ${scopeLabel} code review focused on bugs, behavioral regressions, fragile logic, and missing tests.

Reply format:
- Start with "## Executive Summary" with 2-4 sentences.
- Then "## Findings".
- For each finding, include:
  - Severity: Critical / High / Medium / Low
  - File: exact path
  - Title: short issue name
  - Why it matters: real impact
  - Evidence: concrete behavior or code pattern
  - Fix: specific remediation
- End with "## Gaps" listing any files or runtime context still needed.
- If no high-confidence findings exist, explicitly say "No high-confidence findings found."`,
    smells: `Perform a ${scopeLabel} maintainability review focused on code smells, duplication, poor separation of concerns, and complexity hotspots.

Reply format:
- "## Executive Summary"
- "## Top Smells"
- For each smell, include severity, file path, smell name, impact, and recommended refactor.
- "## Priority Refactors" with the 3 most valuable cleanup actions.
- If nothing significant is found, explicitly say so.`,
    suggest: `Perform a ${scopeLabel} refactoring review. Recommend the highest-value structural improvements and generate safe file changes only when you have enough editable context.

Reply format:
- "## Executive Summary"
- "## Best Refactors"
- For each refactor, include severity, target files, why it helps, risk level, and implementation outline.
- If editable context is sufficient, include fileChanges, and every file change must include severity. Otherwise explain exactly which files are needed.`,
    doc: `Use the ${scopeLabel} context to explain architecture, setup, data flow, and missing documentation. Create documentation files when appropriate.

Reply format:
- "## Project Overview"
- "## Architecture"
- "## Main Flows"
- "## Missing Documentation"
- "## Proposed Docs Changes"
- For each missing doc or proposed doc change, include severity so the user can prioritize it.
- Prefer generating a Markdown file when enough context exists and documentation is materially missing.`,
    security: `Perform a ${scopeLabel} security review focused on auth, secrets, unsafe input handling, insecure defaults, exposed internals, and dependency or configuration risks. Prioritize findings by severity.

Reply format:
- "## Executive Summary"
- "## Security Findings"
- For each finding, include severity, exact file path, attack path or failure mode, impact, and remediation.
- "## Hardening Priorities" with the top next steps.
- If no high-confidence vulnerabilities are found, explicitly say that and mention residual blind spots.`,
    test: `Write unit tests for the ${scopeLabel}. Prefer creating or updating test files with complete, apply-ready contents.

Reply format:
- "## Test Plan"
- "## Proposed Unit Tests"
- For each test area, include severity, exact target file path, behavior covered, and why it matters.
- "## Generated Test Files"
- Create fileChanges for complete test files whenever the provided context is enough.
- Name new test files using the project's existing convention when visible; otherwise use a clear file or folder name that includes "test".
- Use the project's existing test framework and style when visible. If no test framework is configured, explain the missing setup and propose the smallest practical test file plus setup notes.
- Every fileChange must include severity and complete file content.`,
    report: `Write a polished ${scopeLabel} project report that is easy to export as a PDF.

Reply format:
- "## Executive Summary"
- "## Project Purpose"
- "## Architecture Snapshot"
- "## Key Components"
- "## Strengths"
- "## Risks And Gaps"
- "## Recommendations"
- "## Next Steps"
- The "reply" field must contain the full finished report body, not a short preface or placeholder.
- Each section must include concrete, project-specific detail grounded in the provided codebase.
- Reference important files, modules, routes, components, services, or configurations whenever possible.
- Make the report substantial enough for a stakeholder-facing PDF, not just a chat answer.
- When mentioning issues, include severity and file paths when possible.
- Keep the writing concise, professional, and structured for stakeholders as well as developers.`,
    assistant: `Answer the user's request using the available ${scopeLabel} context.

- If you identify issues, options, or file changes, classify each item by severity.
- Every file change must include severity.`,
  };

  return instructions[mode] || instructions.assistant;
}

exports.createAnalysis = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      message,
      fileContext,
      editableFiles,
      projectStructure,
      projectContextFiles,
      conversationHistory,
      analysisMode,
      analysisScope,
      answerCount,
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    const normalizedMode = normalizeAnalysisMode(analysisMode);
    const normalizedScope = analysisScope === 'project' ? 'project' : 'file';
    const candidateCount = normalizeCandidateCount(answerCount);

    let userContent = '';

    userContent += `## Analysis Mode\nMode: ${normalizedMode}\nScope: ${normalizedScope}\nInstruction: ${buildModeInstructions(normalizedMode, normalizedScope)}\n\n`;

    if (projectStructure && projectStructure.length > 0) {
      const fileList = projectStructure
        .slice(0, MAX_PROJECT_FILES)
        .map((file) => file.path)
        .join('\n');
      userContent += `## Project Structure\n\`\`\`\n${fileList}\n\`\`\`\n\n`;
    }

    const projectContextBlock = formatProjectContextFiles(projectContextFiles);
    if (projectContextBlock) {
      userContent += `## Project Context Files\n${projectContextBlock}\n\n`;
    }

    if (fileContext) {
      userContent += `## Active File\nPath: ${fileContext.path}\nLanguage: ${fileContext.language || 'text'}\n\n`;
    }

    const editableFileBlock = formatEditableFiles(editableFiles);
    if (editableFileBlock) {
      userContent += `## Editable Files\n${editableFileBlock}\n\n`;
    }

    userContent += `## User Request\n${message}`;

    const groqMessages = [];

    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          groqMessages.push({
            role: msg.role,
            content: msg.content || '',
          });
        }
      }
    }

    groqMessages.push({ role: 'user', content: userContent });

    const rawResults = await callGroqCandidates({
      systemPrompt: SYSTEM_PROMPT,
      messages: groqMessages,
      candidateCount,
    });
    const parsedCandidates = rawResults.map((rawResult) => parseAssistantResponse(rawResult));
    let rawResult = rawResults[0];
    let parsedResult = parsedCandidates[0];

    if (normalizedMode === 'report' && isThinReport(parsedResult.reply)) {
      parsedResult = await expandThinReport({
        groqMessages,
        rawResult,
        parsedResult,
      });
      parsedCandidates[0] = parsedResult;
      rawResult = parsedResult.reply;
    }
    const duration = Date.now() - startTime;

    const analysis = await Analysis.create({
      user: req.user._id,
      code: normalizedScope === 'project' ? message : (fileContext?.content || message),
      language: normalizedScope === 'project' ? 'Project' : (fileContext?.language || 'text'),
      mode: normalizedMode,
      fileName: normalizedScope === 'project' ? null : (fileContext?.path || null),
      linesCount: (normalizedScope === 'project' ? message : (fileContext?.content || message)).split('\n').length,
      result: { rawText: parsedResult.reply, fileChanges: parsedResult.fileChanges || [] },
      duration,
    });

    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalAnalyses': 1 },
      'stats.lastActiveAt': new Date(),
    });

    res.status(201).json({
      success: true,
      result: parsedResult.reply,
      fileChanges: parsedResult.fileChanges,
      needsMoreContext: parsedResult.needsMoreContext,
      selectedCandidateIndex: 0,
      candidates: parsedCandidates.map((candidate, index) => ({
        index,
        reply: candidate.reply,
        fileChanges: candidate.fileChanges,
        needsMoreContext: candidate.needsMoreContext,
      })),
      analysisId: analysis._id,
    });
  } catch (error) {
    console.error('[analysisController] createAnalysis error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.user._id })
      .select('-code')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, analyses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const range = String(req.query.range || '7d').toLowerCase();
    const rangeMap = { '7d': 7, '30d': 30, '90d': 90, all: null };
    const days = rangeMap[range] ?? 7;
    const query = { user: userId };

    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      query.createdAt = { $gte: since };
    }

    const totalAnalyses = await Analysis.countDocuments(query);
    const recentAnalyses = await Analysis.find(query)
      .select('mode createdAt result.fileChanges fileName result.rawText')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const lastAnalysis = recentAnalyses[0] || null;
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    const recentFindings = recentAnalyses.map((item) => {
      const fileChanges = Array.isArray(item.result?.fileChanges) ? item.result.fileChanges : [];

      for (const change of fileChanges) {
        const severity = VALID_SEVERITIES.has(change.severity) ? change.severity : null;
        if (severity) {
          severityCounts[severity] += 1;
        }
      }

      return {
        _id: item._id,
        mode: item.mode,
        createdAt: item.createdAt,
        fileName: item.fileName,
        summary: fileChanges[0]?.summary || item.result?.rawText?.slice(0, 220) || '',
        fileChanges,
      };
    });

    res.status(200).json({
      success: true,
      dashboard: {
        totalAnalyses,
        lastAnalysis,
        recentFindings,
        severityCounts,
        range,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    res.status(200).json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    res.status(200).json({ success: true, message: 'Analysis deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
