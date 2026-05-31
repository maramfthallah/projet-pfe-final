// controllers/pushController.js
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
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  return res.json();
}

/**
 * POST /api/github/repos/:owner/:repo/push
 * Body: { branch, message, files: [{ path, content }] }
 *
 * Creates a new commit on the specified branch with the given file changes.
 * Uses the GitHub Git Data API (blobs → tree → commit → update ref).
 */
exports.pushChanges = async (req, res) => {
  try {
    const token = await getGitHubToken(req.user._id);
    const { owner, repo } = req.params;
    const { branch = 'main', message = 'Update files via SmartCodeReview', files } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files to push' });
    }

    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // 1. Get the current branch reference
    const refData = await ghFetch(`${apiBase}/git/refs/heads/${branch}`, token);
    const latestCommitSha = refData.object.sha;

    // 2. Get the current commit to find the base tree
    const commitData = await ghFetch(`${apiBase}/git/commits/${latestCommitSha}`, token);
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      const blobData = await ghFetch(`${apiBase}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8',
        }),
      });

      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha:  blobData.sha,
      });
    }

    // 4. Create a new tree
    const newTree = await ghFetch(`${apiBase}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree:      treeItems,
      }),
    });

    // 5. Create a new commit
    const newCommit = await ghFetch(`${apiBase}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree:    newTree.sha,
        parents: [latestCommitSha],
      }),
    });

    // 6. Update the branch reference
    await ghFetch(`${apiBase}/git/refs/heads/${branch}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        sha:   newCommit.sha,
        force: false,
      }),
    });

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalPushes': 1 },
      'stats.lastActiveAt': new Date(),
    });

    res.json({
      success:   true,
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
      message:   `Successfully pushed ${files.length} file(s)`,
    });
  } catch (error) {
    console.error('[pushController] pushChanges error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
