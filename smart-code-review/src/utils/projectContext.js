import { getLangFromPath, isBinaryFile } from '../constants/modes';

const MAX_CONTEXT_FILES = 14;
const MAX_CONTEXT_FILE_CHARS = 12000;
const MAX_CONTEXT_TOTAL_CHARS = 80000;
const MAX_CONTEXT_FILE_SIZE = 50000;

const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  'vendor',
  'target',
  'bin',
  'obj',
]);

const ROOT_PRIORITY = {
  'readme.md': 120,
  'package.json': 110,
  'package-lock.json': 70,
  'pnpm-lock.yaml': 70,
  'yarn.lock': 70,
  'docker-compose.yml': 95,
  'dockerfile': 95,
  '.env.example': 90,
  '.gitignore': 65,
  'vite.config.js': 85,
  'vite.config.ts': 85,
  'tsconfig.json': 85,
  'jsconfig.json': 80,
  'server.js': 100,
  'app.js': 95,
  'main.jsx': 90,
  'main.js': 90,
  'index.js': 85,
  'index.jsx': 85,
};

function normalizePath(filePath) {
  if (typeof filePath !== 'string') return '';

  return filePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '');
}

function hasIgnoredSegment(filePath) {
  return normalizePath(filePath)
    .split('/')
    .some((segment) => IGNORED_SEGMENTS.has(segment.toLowerCase()));
}

function isGeneratedOrMinified(filePath) {
  const lowerPath = normalizePath(filePath).toLowerCase();
  return lowerPath.endsWith('.min.js')
    || lowerPath.endsWith('.min.css')
    || lowerPath.endsWith('.map')
    || lowerPath.endsWith('.lockb');
}

function isEligibleProjectFile(file) {
  const normalizedPath = normalizePath(file?.path);

  if (!normalizedPath || file?.type !== 'file') return false;
  if (hasIgnoredSegment(normalizedPath) || isGeneratedOrMinified(normalizedPath)) return false;
  if (isBinaryFile(normalizedPath)) return false;
  if (typeof file?.size === 'number' && file.size > MAX_CONTEXT_FILE_SIZE) return false;

  return true;
}

function scoreProjectFile(filePath, activeFilePath, openFileSet) {
  const normalizedPath = normalizePath(filePath);
  const lowerPath = normalizedPath.toLowerCase();
  const segments = lowerPath.split('/');
  const fileName = segments[segments.length - 1];
  let score = 0;

  if (normalizedPath === activeFilePath) score += 300;
  if (openFileSet.has(normalizedPath)) score += 180;
  if (ROOT_PRIORITY[fileName]) score += ROOT_PRIORITY[fileName];
  if (segments.length === 1) score += 35;
  if (lowerPath.startsWith('src/')) score += 55;
  if (lowerPath.startsWith('app/')) score += 50;
  if (lowerPath.startsWith('lib/')) score += 45;
  if (lowerPath.startsWith('pages/')) score += 35;
  if (lowerPath.startsWith('components/')) score += 30;
  if (lowerPath.startsWith('controllers/')) score += 70;
  if (lowerPath.startsWith('routes/')) score += 70;
  if (lowerPath.startsWith('models/')) score += 60;
  if (lowerPath.startsWith('middleware/')) score += 55;
  if (lowerPath.startsWith('config/')) score += 50;
  if (lowerPath.includes('/security') || lowerPath.includes('auth')) score += 35;
  if (lowerPath.includes('test') || lowerPath.includes('spec')) score += 25;
  if (fileName.endsWith('.md')) score += 20;

  return score;
}

export function shouldUseProjectScope(message, { activeFilePath, projectMode = false } = {}) {
  if (projectMode) return true;
  if (!activeFilePath) return true;
  if (typeof message !== 'string') return false;

  return /\b(project|workspace|repository|repo|codebase|whole project|entire project|all files|overall architecture|security audit|documentation)\b/i
    .test(message);
}

export async function buildProjectContextFiles({
  files = [],
  fileContents = {},
  activeFilePath = '',
  openFiles = [],
  excludedPaths = [],
  loadFileContent,
}) {
  const normalizedActivePath = normalizePath(activeFilePath);
  const openFileSet = new Set(openFiles.map(normalizePath).filter(Boolean));
  const excludedPathSet = new Set(excludedPaths.map(normalizePath).filter(Boolean));

  const rankedFiles = files
    .filter(isEligibleProjectFile)
    .filter((file) => !excludedPathSet.has(normalizePath(file.path)))
    .map((file) => ({
      ...file,
      normalizedPath: normalizePath(file.path),
      score: scoreProjectFile(file.path, normalizedActivePath, openFileSet),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      const leftSize = typeof left.size === 'number' ? left.size : Number.MAX_SAFE_INTEGER;
      const rightSize = typeof right.size === 'number' ? right.size : Number.MAX_SAFE_INTEGER;
      if (leftSize !== rightSize) return leftSize - rightSize;

      return left.normalizedPath.localeCompare(right.normalizedPath);
    });

  const projectFiles = [];
  let totalChars = 0;

  for (const file of rankedFiles) {
    if (projectFiles.length >= MAX_CONTEXT_FILES) break;

    let content = typeof fileContents[file.normalizedPath] === 'string'
      ? fileContents[file.normalizedPath]
      : null;

    if (content === null && typeof loadFileContent === 'function') {
      try {
        // eslint-disable-next-line no-await-in-loop
        content = await loadFileContent(file.normalizedPath);
      } catch (error) {
        continue;
      }
    }

    if (typeof content !== 'string' || !content.trim()) continue;
    if (content.length > MAX_CONTEXT_FILE_SIZE) continue;

    const estimatedChars = Math.min(content.length, MAX_CONTEXT_FILE_CHARS);
    if (
      projectFiles.length >= 6
      && totalChars + estimatedChars > MAX_CONTEXT_TOTAL_CHARS
    ) {
      continue;
    }

    projectFiles.push({
      path: file.normalizedPath,
      content,
      language: getLangFromPath(file.normalizedPath),
    });
    totalChars += estimatedChars;
  }

  return projectFiles;
}
