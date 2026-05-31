import { useState, useEffect, useCallback } from 'react';
import { githubAPI } from '../../utils/api';
import './RepoSelector.css';

/* ═══════════════════════════════════════════
   REPO SELECTOR — Modal to pick a GitHub repo
═══════════════════════════════════════════ */
export default function RepoSelector({ onSelect, onClose }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  // Fetch repos on mount
  useEffect(() => {
    setLoading(true);
    githubAPI.getRepos()
      .then(res => {
        if (res.data?.success) {
          setRepos(res.data.repos);
        }
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Failed to load repositories');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = query.trim()
    ? repos.filter(r =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(query.toLowerCase())
      )
    : repos;

  const handleSelect = useCallback((repo) => {
    onSelect(repo);
    onClose();
  }, [onSelect, onClose]);

  return (
    <div className="rs__overlay" onClick={onClose}>
      <div className="rs" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" id="repo-selector">

        <div className="rs__header">
          <div className="rs__header-left">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ color: 'var(--text-secondary)' }}>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <h2>Select Repository</h2>
          </div>
          <button className="rs__close" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="rs__search">
          <span className="material-symbols-rounded">search</span>
          <input
            type="text"
            placeholder="Find a repository..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            id="repo-search"
          />
        </div>

        <div className="rs__list">
          {loading && (
            <div className="rs__loading">
              <div className="rs__spinner" />
              <span>Loading repositories...</span>
            </div>
          )}

          {error && (
            <div className="rs__error">
              <span className="material-symbols-rounded">error</span>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rs__empty">
              <span className="material-symbols-rounded">search_off</span>
              <span>No repositories found</span>
            </div>
          )}

          {filtered.map(repo => (
            <button
              key={repo.id}
              className="rs__repo"
              onClick={() => handleSelect(repo)}
            >
              <div className="rs__repo-main">
                <div className="rs__repo-name">
                  <span>{repo.name}</span>
                  {repo.private && (
                    <span className="rs__repo-private">
                      <span className="material-symbols-rounded">lock</span>
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="rs__repo-desc">{repo.description}</p>
                )}
                <div className="rs__repo-meta">
                  {repo.language && (
                    <span className="rs__repo-lang">
                      <span className="rs__lang-dot" />
                      {repo.language}
                    </span>
                  )}
                  <span className="rs__repo-time">
                    Updated {new Date(repo.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <span className="material-symbols-rounded rs__repo-arrow">arrow_forward</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
