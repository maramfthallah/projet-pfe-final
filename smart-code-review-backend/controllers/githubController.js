// controllers/githubController.js
const User = require('../models/User');

// Helper: get user's GitHub token
async function getGitHubToken(userId) {
  const user = await User.findById(userId).select('+githubAccessToken');
  if (!user || !user.githubAccessToken) {
    throw new Error('GitHub token not found. Please re-authenticate.');
  }
  return user.githubAccessToken;
}

// Helper: call GitHub API
async function ghFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'SmartCodeReview',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  return res.json();
}

// ─── GET /api/github/repos — List user's repos ───
exports.getRepos = async (req, res) => {
  try {
    const token = await getGitHubToken(req.user._id);

    // Fetch repos sorted by last push, up to 100
    const repos = await ghFetch(
      'https://api.github.com/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator',
      token
    );

    const mapped = repos.map(r => ({
      id:          r.id,
      name:        r.name,
      fullName:    r.full_name,
      description: r.description,
      private:     r.private,
      language:    r.language,
      defaultBranch: r.default_branch,
      updatedAt:   r.pushed_at,
      htmlUrl:     r.html_url,
      owner: {
        login:     r.owner.login,
        avatar:    r.owner.avatar_url,
      },
    }));

    res.json({ success: true, repos: mapped });
  } catch (error) {
    console.error('[githubController] getRepos error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/github/repos/:owner/:repo/branches — List branches ───
exports.getBranches = async (req, res) => {
  try {
    const token = await getGitHubToken(req.user._id);
    const { owner, repo } = req.params;

    const branches = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      token
    );

    const mapped = branches.map(b => ({
      name:      b.name,
      sha:       b.commit.sha,
      protected: b.protected,
    }));

    res.json({ success: true, branches: mapped });
  } catch (error) {
    console.error('[githubController] getBranches error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/github/repos/:owner/:repo/tree — Get file tree ───
exports.getRepoTree = async (req, res) => {
  try {
    const token = await getGitHubToken(req.user._id);
    const { owner, repo } = req.params;
    const branch = req.query.branch || 'main';

    const tree = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token
    );

    // Filter and structure the tree
    const files = tree.tree
      .filter(item => item.type === 'blob' || item.type === 'tree')
      .map(item => ({
        path:  item.path,
        type:  item.type === 'tree' ? 'dir' : 'file',
        sha:   item.sha,
        size:  item.size || 0,
      }));

    res.json({ success: true, files, sha: tree.sha, truncated: tree.truncated });
  } catch (error) {
    console.error('[githubController] getRepoTree error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/github/repos/:owner/:repo/contents/* — Get file content ───
exports.getFileContent = async (req, res) => {
  try {
    const token = await getGitHubToken(req.user._id);
    const { owner, repo } = req.params;
    const filePath = req.params[0]; // wildcard catch
    const branch = req.query.branch || 'main';

    const data = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      token
    );

    // Decode base64 content
    let content = '';
    if (data.encoding === 'base64' && data.content) {
      content = Buffer.from(data.content, 'base64').toString('utf-8');
    }

    res.json({
      success: true,
      file: {
        name:     data.name,
        path:     data.path,
        sha:      data.sha,
        size:     data.size,
        content,
        encoding: data.encoding,
      },
    });
  } catch (error) {
    console.error('[githubController] getFileContent error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
