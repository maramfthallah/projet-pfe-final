import './header.css';

export default function Header({
  user,
  onLoginGitHub,
  onLogout,
  onToggleExplorer,
  onToggleChat,
  onShowDashboard,
  isDashboardActive,
  explorerOpen,
  chatOpen,
  repo,
}) {
  return (
    <header className="hdr" id="app-header">

      {/* ── LEFT ── */}
      <div className="hdr__left">
        {/* Explorer toggle */}
        {user && (
          <button
            className={`hdr__icon-btn ${explorerOpen ? 'hdr__icon-btn--active' : ''}`}
            onClick={onToggleExplorer}
            title={explorerOpen ? 'Hide Explorer' : 'Show Explorer'}
            id="toggle-explorer-btn"
          >
            <span className="material-symbols-rounded">
              {explorerOpen ? 'side_navigation' : 'menu'}
            </span>
          </button>
        )}

        {/* Logo */}
        <a href="/" className="hdr__brand" onClick={e => { e.preventDefault(); onLogout && onLogout(); }}>
          <div className="hdr__brand-mark">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5L9.8 5.2L14 5.8L11 8.7L11.7 13L8 11L4.3 13L5 8.7L2 5.8L6.2 5.2L8 1.5Z"
                fill="white"
              />
            </svg>
          </div>
          <span className="hdr__brand-name">
            Smart<span>Code<span>Review</span></span>
          </span>
        </a>

        {/* Repo name in header */}
        {repo && (
          <div className="hdr__repo-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>{repo.name}</span>
          </div>
        )}
      </div>

      {/* ── RIGHT ── */}
      <div className="hdr__right">
        {user ? (
          <>
            {/* Dashboard toggle */}
            <button
              className={`hdr__icon-btn ${isDashboardActive ? 'hdr__icon-btn--active' : ''}`}
              onClick={onShowDashboard}
              title={isDashboardActive ? 'Retour au workspace' : 'Ouvrir le dashboard'}
              id="toggle-dashboard-btn"
            >
              <span className="material-symbols-rounded">
                {isDashboardActive ? 'view_timeline' : 'dashboard'}
              </span>
            </button>

            {/* Chat toggle */}
            <button
              className={`hdr__icon-btn ${chatOpen ? 'hdr__icon-btn--active' : ''}`}
              onClick={onToggleChat}
              title={chatOpen ? 'Hide AI Chat' : 'Show AI Chat'}
              id="toggle-chat-btn"
            >
              <span className="material-symbols-rounded">smart_toy</span>
            </button>

            {/* User info */}
            <div className="hdr__user">
              {user.githubAvatar ? (
                <img
                  src={user.githubAvatar}
                  alt={user.githubUsername}
                  className="hdr__avatar"
                />
              ) : (
                <div className="hdr__avatar-fallback">
                  {(user.displayName || user.githubUsername || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="hdr__user-name">
                {user.displayName || user.githubUsername}
              </span>
            </div>

            {/* Logout */}
            <button className="hdr__btn-logout" onClick={onLogout} id="logout-btn">
              <span className="material-symbols-rounded">logout</span>
            </button>
          </>
        ) : (
          <button className="hdr__btn-github" onClick={onLoginGitHub} id="login-github-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>
        )}
      </div>
    </header>
  );
}