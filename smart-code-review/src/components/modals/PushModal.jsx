import { useState } from 'react';
import './PushModal.css';

/* ═══════════════════════════════════════════
   PUSH MODAL — Confirm push to GitHub
═══════════════════════════════════════════ */
export default function PushModal({
  modifiedFiles = [],
  fileContents = {},
  originalContents = {},
  repo,
  branch,
  onPush,
  onClose,
  isPushing = false,
}) {
  const [commitMessage, setCommitMessage] = useState('');

  const handlePush = () => {
    if (!commitMessage.trim()) return;
    onPush(commitMessage.trim());
  };

  return (
    <div className="pm__overlay" onClick={onClose}>
      <div className="pm" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" id="push-modal">

        {/* Header */}
        <div className="pm__header">
          <div className="pm__header-left">
            <span className="material-symbols-rounded pm__header-icon">cloud_upload</span>
            <h2>Push to GitHub</h2>
          </div>
          <button className="pm__close" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {/* Repo info */}
        <div className="pm__repo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ opacity: 0.7 }}>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>{repo?.fullName}</span>
          <span className="pm__branch">
            <span className="material-symbols-rounded">fork_right</span>
            {branch}
          </span>
        </div>

        {/* Changed files list */}
        <div className="pm__files">
          <div className="pm__files-header">
            <span className="material-symbols-rounded">description</span>
            <span>{modifiedFiles.length} changed file{modifiedFiles.length > 1 ? 's' : ''}</span>
          </div>
          <ul className="pm__files-list">
            {modifiedFiles.map(path => (
              <li key={path} className="pm__file">
                <span className="material-symbols-rounded pm__file-icon">edit_note</span>
                <span className="pm__file-path">{path}</span>
                <span className="pm__file-badge">Modified</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Commit message */}
        <div className="pm__commit">
          <label className="pm__commit-label" htmlFor="commit-msg">
            Commit message
          </label>
          <textarea
            id="commit-msg"
            className="pm__commit-input"
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder="Describe your changes..."
            rows={3}
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="pm__actions">
          <button className="pm__cancel" onClick={onClose} disabled={isPushing}>
            Cancel
          </button>
          <button
            className="pm__submit"
            onClick={handlePush}
            disabled={!commitMessage.trim() || isPushing}
            id="confirm-push-btn"
          >
            {isPushing ? (
              <>
                <span className="pm__spinner" />
                Pushing...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded">cloud_upload</span>
                Push Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
