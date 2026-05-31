/**
 * ============================================================
 *  SmartCodeReview — Frontend API Service
 * ============================================================
 *  GitHub OAuth, GitHub API proxy, AI analysis, push.
 * ============================================================
 */

import axios from 'axios';

// ─── Base instance ───
const API_URL =
  import.meta?.env?.VITE_API_URL || 'http://localhost:5000/api';

const BACKEND_URL =
  import.meta?.env?.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000, // 2 minutes for large file operations
});

function extractLooseJsonReply(text) {
  if (typeof text !== 'string') return null;

  const match = text.match(/^\s*\{[\s\S]*"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:needsMoreContext|fileChanges)"\s*:/);
  if (!match?.[1]) return null;

  return match[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .trim();
}

export function normalizeAssistantReply(value) {
  if (value && typeof value === 'object' && typeof value.reply === 'string') {
    return value.reply.trim();
  }

  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.reply === 'string') {
      return parsed.reply.trim();
    }
  } catch (error) {
    const looseReply = extractLooseJsonReply(trimmed);
    if (looseReply) return looseReply;
  }

  return trimmed;
}

// ─── Interceptor: attach JWT token automatically ───
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scr_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor: handle 401 globally ───
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('scr_token');
      localStorage.removeItem('scr_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

// ============================================================
//  AUTH — GitHub OAuth
// ============================================================
export const authAPI = {
  /** Local Register */
  register: (data) => api.post('/auth/register', data),

  /** Local Login */
  login: (data) => api.post('/auth/login', data),

  /** Redirect to GitHub OAuth */
  getGitHubAuthUrl: () => `${BACKEND_URL}/api/auth/github`,

  /** Redirect to Google OAuth */
  getGoogleAuthUrl: () => `${BACKEND_URL}/api/auth/google`,

  /** GET /api/auth/profile */
  getProfile: () => api.get('/auth/profile'),

  /** POST /api/auth/logout */
  logout: () => api.post('/auth/logout'),
};

// ============================================================
//  GITHUB — Repository & File operations
// ============================================================
export const githubAPI = {
  /** List user's repos */
  getRepos: () => api.get('/github/repos'),

  /** List branches for a repo */
  getBranches: (owner, repo) =>
    api.get(`/github/repos/${owner}/${repo}/branches`),

  /** Get file tree for a repo/branch */
  getTree: (owner, repo, branch = 'main') =>
    api.get(`/github/repos/${owner}/${repo}/tree`, { params: { branch } }),

  /** Get file content */
  getFileContent: (owner, repo, path, branch = 'main') =>
    api.get(`/github/repos/${owner}/${repo}/contents/${path}`, { params: { branch } }),

  /** Push changes */
  push: (owner, repo, { branch, message, files }) =>
    api.post(`/github/repos/${owner}/${repo}/push`, { branch, message, files }),
};

// ============================================================
//  AI ANALYSIS — File-aware coding assistant
// ============================================================

/**
 * Send a message to the AI coding assistant.
 *
 * @param {string}  message             - User's message/request
 * @param {Object}  fileContext         - { path, content, language }
 * @param {Array}   editableFiles       - [{ path, content, language }]
 * @param {Array}   projectStructure    - [{ path, type }]
 * @param {Array}   conversationHistory - [{ role, content }]
 * @returns {Promise<Object>} Assistant reply and structured file changes
 */
export async function callAI(
  message,
  fileContext,
  editableFiles,
  projectStructure,
  projectContextFiles,
  conversationHistory,
  options = {},
) {
  try {
    const { data } = await api.post('/analyses', {
      message,
      fileContext,
      editableFiles,
      projectStructure,
      projectContextFiles,
      conversationHistory,
      analysisMode: options.analysisMode,
      analysisScope: options.analysisScope,
      answerCount: options.answerCount,
    });

    const candidates = Array.isArray(data.candidates)
      ? data.candidates.map((candidate, index) => ({
          index: Number.isInteger(candidate.index) ? candidate.index : index,
          reply: normalizeAssistantReply(candidate.reply) || 'No response received.',
          fileChanges: Array.isArray(candidate.fileChanges) ? candidate.fileChanges : [],
          needsMoreContext: Boolean(candidate.needsMoreContext),
        }))
      : [];

    return {
      reply: normalizeAssistantReply(data.result) || 'No response received.',
      fileChanges: Array.isArray(data.fileChanges) ? data.fileChanges : [],
      needsMoreContext: Boolean(data.needsMoreContext),
      selectedCandidateIndex: Number.isInteger(data.selectedCandidateIndex) ? data.selectedCandidateIndex : 0,
      candidates,
    };
  } catch (err) {
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      `API Error ${err.response?.status || 'network'}`;
    throw new Error(msg);
  }
}

// ============================================================
//  ANALYSES — History
// ============================================================
export const analysisAPI = {
  getAll:  () => api.get('/analyses'),
  getDashboard: (params) => api.get('/analyses/dashboard', { params }),
  getById: (id) => api.get(`/analyses/${id}`),
  delete:  (id) => api.delete(`/analyses/${id}`),
};

export default api;
