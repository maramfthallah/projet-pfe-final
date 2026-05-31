import { useState, useCallback } from 'react';
import { MODE_MAP } from '../../constants/modes';
import { formatMarkdown } from '../../utils/markdown';
import TypingDots from './TypingDots';

/* ══════════════════════════════════════
   MESSAGE COMPONENT
   Renders a single chat message (user or assistant).
══════════════════════════════════════ */
export default function Message({ msg }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [msg.content]);

  const isUser = msg.role === 'user';

  /* ── User message ── */
  if (isUser) {
    return (
      <div className="ml__msg ml__msg--user">
        <div className="ml__msg-avatar ml__msg-avatar--user">
          <span className="material-symbols-rounded">person</span>
        </div>
        <div className="ml__msg-bubble">
          <div className="ml__msg-user-content">
            {/* Code submission preview */}
            {msg.code && (
              <div className="ml__msg-code-preview">
                <span className="material-symbols-rounded">code</span>
                <span>{msg.language || 'Code'}</span>
                {msg.lines != null && (
                  <span className="ml__msg-lines">{msg.lines} lignes</span>
                )}
              </div>
            )}

            {/* File tag */}
            {msg.file && (
              <div className="ml__msg-file">
                <span className="material-symbols-rounded">description</span>
                <span>{msg.file}</span>
              </div>
            )}

            {/* Text content */}
            {msg.content && <p>{msg.content}</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ── Assistant message ── */
  const modeInfo = msg.mode ? MODE_MAP[msg.mode] : null;

  return (
    <div className="ml__msg ml__msg--ai">
      <div className="ml__msg-avatar">
        <span className="material-symbols-rounded">smart_toy</span>
      </div>
      <div className="ml__msg-bubble">
        {/* Mode tag */}
        {modeInfo && (
          <div className="ml__msg-mode-tag">
            <span className="material-symbols-rounded">{modeInfo.icon}</span>
            {modeInfo.label}
          </div>
        )}

        {/* Loading state */}
        {msg.loading ? (
          <TypingDots />
        ) : (
          <>
            {/* Markdown content */}
            <div
              className="ml__msg-content"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
            />

            {/* Action buttons */}
            {msg.content && (
              <div className="ml__msg-actions">
                <button
                  className="ml__msg-action-btn"
                  onClick={handleCopy}
                  title="Copier le texte"
                >
                  <span className="material-symbols-rounded">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}