export const ANALYSIS_MODE_CONFIG = {
  review: {
    key: 'review',
    label: 'Revue complete',
    icon: 'rate_review',
    prompt: 'Analyze the whole project for bugs, logic issues, regressions, architecture risks, and missing tests. Prioritize findings by severity, cite concrete file paths, and include apply-ready fixes only when you have enough context.',
  },
  smells: {
    key: 'smells',
    label: 'Code Smells',
    icon: 'warning',
    prompt: 'Analyze the whole project for maintainability issues, code smells, duplication, weak abstractions, and risky complexity. Classify findings by severity, group the highest-impact problems, and suggest the most valuable cleanups.',
  },
  suggest: {
    key: 'suggest',
    label: 'Refactorisation',
    icon: 'build_circle',
    prompt: 'Review the whole project and propose the best refactors to improve structure, readability, and long-term maintainability. Classify each recommendation by severity, highlight the best impact-to-risk opportunities, and generate safe file changes when possible.',
  },
  doc: {
    key: 'doc',
    label: 'Documentation',
    icon: 'description',
    prompt: 'Generate or improve project documentation using the whole codebase context. Explain the architecture, important flows, setup details, and missing docs. Classify missing documentation by severity so the user can prioritize it, and create new documentation files when that is the safest way to help.',
  },
  security: {
    key: 'security',
    label: 'Securite',
    icon: 'shield_lock',
    prompt: 'Perform a whole-project security audit. Look for auth flaws, secrets handling issues, injection risks, unsafe API exposure, insecure defaults, and dependency or configuration risks. Prioritize findings by severity and propose safe remediations.',
  },
  test: {
    key: 'test',
    label: 'Unit Tests',
    icon: 'science',
    prompt: 'Write unit tests for the project. Inspect the codebase, identify the best test targets, and create or update test files named with the project convention, using "test" in the filename or folder when appropriate. Prefer apply-ready file changes with complete test file contents, include setup notes if a test runner or dependency is missing, and classify every proposed test change by severity.',
  },
  report: {
    key: 'report',
    label: 'Rapport',
    icon: 'assignment',
    prompt: 'Write a complete project report based on the whole codebase. Include the project purpose, architecture, important modules, current strengths, notable risks, and clear next-step recommendations in a polished structure that works well as a downloadable PDF.',
  },
};

export const PROJECT_ANALYSIS_MODES = [
  ANALYSIS_MODE_CONFIG.review,
  ANALYSIS_MODE_CONFIG.smells,
  ANALYSIS_MODE_CONFIG.suggest,
  ANALYSIS_MODE_CONFIG.doc,
  ANALYSIS_MODE_CONFIG.security,
  ANALYSIS_MODE_CONFIG.test,
  ANALYSIS_MODE_CONFIG.report,
];

export function getAnalysisModeConfig(mode) {
  return ANALYSIS_MODE_CONFIG[mode] || null;
}
