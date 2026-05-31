import { useState, useRef, useEffect, useCallback } from 'react';
import { PROJECT_ANALYSIS_MODES } from '../../constants/analysisModes';
import './AIChat.css';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
const REPORT_SECTION_TITLES = new Set([
  'Executive Summary',
  'Project Purpose',
  'Architecture Snapshot',
  'Key Components',
  'Strengths',
  'Risks And Gaps',
  'Recommendations',
  'Next Steps',
  'Test Plan',
  'Proposed Unit Tests',
  'Generated Test Files',
]);

function normalizeSeverity(severity) {
  const normalized = typeof severity === 'string' ? severity.trim().toLowerCase() : '';
  return SEVERITY_ORDER.includes(normalized) ? normalized : 'medium';
}

function renderContent(text) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    const codeMatch = part.match(/^```(\S*)\n?([\s\S]*?)```$/);
    if (codeMatch) {
      const lang = codeMatch[1] || 'code';
      const code = codeMatch[2].trim();

      return (
        <div key={index} className="ai__code-block">
          <div className="ai__code-header">
            <span className="ai__code-lang">{lang}</span>
            <button
              className="ai__code-copy"
              onClick={() => navigator.clipboard.writeText(code)}
              title="Copy code"
              type="button"
            >
              <span className="material-symbols-rounded">content_copy</span>
            </button>
          </div>
          <pre className="ai__code-pre"><code>{code}</code></pre>
        </div>
      );
    }

    if (!part.trim()) return null;

    const lines = part.split('\n').map((line, lineIndex) => {
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/`([^`]+)`/g, '<code class="ai__inline-code">$1</code>');

      if (formatted.startsWith('### ')) {
        return <h4 key={lineIndex} className="ai__heading">{formatted.slice(4)}</h4>;
      }
      if (formatted.startsWith('## ')) {
        return <h3 key={lineIndex} className="ai__heading">{formatted.slice(3)}</h3>;
      }
      if (formatted.startsWith('# ')) {
        return <h2 key={lineIndex} className="ai__heading">{formatted.slice(2)}</h2>;
      }
      if (REPORT_SECTION_TITLES.has(formatted.trim())) {
        return <h3 key={lineIndex} className="ai__heading">{formatted.trim()}</h3>;
      }
      if (/^[-*] /.test(formatted)) {
        return (
          <li
            key={lineIndex}
            className="ai__list-item"
            dangerouslySetInnerHTML={{ __html: formatted.slice(2) }}
          />
        );
      }
      if (/^\d+\. /.test(formatted)) {
        return (
          <li
            key={lineIndex}
            className="ai__list-item ai__list-item--ordered"
            dangerouslySetInnerHTML={{ __html: formatted.replace(/^\d+\. /, '') }}
          />
        );
      }
      if (!formatted.trim()) return <br key={lineIndex} />;

      return (
        <p
          key={lineIndex}
          className="ai__text"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    });

    return <div key={index} className="ai__text-block">{lines}</div>;
  });
}

function TypingIndicator() {
  return (
    <div className="ai__typing">
      <span className="ai__typing-dot" />
      <span className="ai__typing-dot" />
      <span className="ai__typing-dot" />
    </div>
  );
}

function FileChangeCard({
  messageId,
  change,
  isApplied,
  isApplying,
  error,
  onApplyOne,
}) {
  const preview = change.content.split('\n').slice(0, 12).join('\n');
  const severity = normalizeSeverity(change.severity);

  return (
    <div className={`ai__change-card ai__change-card--${severity} ${isApplied ? 'ai__change-card--applied' : ''}`}>
      <div className="ai__change-head">
        <div className="ai__change-meta">
          <span className="ai__change-path" title={change.path}>{change.path}</span>
          <span className={`ai__severity-badge ai__severity-badge--${severity}`}>
            {SEVERITY_LABELS[severity]}
          </span>
          <span className={`ai__change-badge ai__change-badge--${change.operation || 'update'}`}>
            {change.operation || 'update'}
          </span>
        </div>
        <button
          className="ai__code-copy"
          onClick={() => navigator.clipboard.writeText(change.content)}
          title="Copy file contents"
          type="button"
        >
          <span className="material-symbols-rounded">content_copy</span>
        </button>
      </div>

      {change.summary && (
        <p className="ai__change-summary">{change.summary}</p>
      )}

      <pre className="ai__change-preview"><code>{preview}</code></pre>

      <div className="ai__change-actions">
        <button
          type="button"
          className="ai__apply-btn"
          onClick={() => onApplyOne(messageId, change)}
          disabled={isApplied || isApplying}
        >
          <span className="material-symbols-rounded">
            {isApplied ? 'task_alt' : isApplying ? 'hourglass_empty' : 'check_circle'}
          </span>
          <span>{isApplied ? 'Applied' : isApplying ? 'Applying...' : 'Apply Change'}</span>
        </button>
        {error && <span className="ai__change-error">{error}</span>}
      </div>
    </div>
  );
}

export default function AIChat({
  messages = [],
  isLoading = false,
  onSendMessage,
  onRunProjectAnalysis,
  hasProject = false,
  onApplyChange,
  activeFilePath,
  modifiedFilesCount = 0,
  onPushClick,
  projectType,
  onShowHistory,
  onNewChat,
  onDownloadPdf,
  answerCount = 1,
  onAnswerCountChange,
  onSelectCandidate,
}) {
  const [input, setInput] = useState('');
  const [applyingKeys, setApplyingKeys] = useState({});
  const [applyErrors, setApplyErrors] = useState({});
  const [changeSeverityFilters, setChangeSeverityFilters] = useState({});
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    onSendMessage(text);
    setInput('');
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }, [handleSubmit]);

  const handleApplyOne = useCallback(async (messageId, change) => {
    const key = `${messageId}:${change.path}`;

    setApplyingKeys((prev) => ({ ...prev, [key]: true }));
    setApplyErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      await onApplyChange(messageId, change);
    } catch (error) {
      setApplyErrors((prev) => ({ ...prev, [key]: error.message || 'Failed to apply change.' }));
    } finally {
      setApplyingKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [onApplyChange]);

  const handleApplyAll = useCallback(async (message) => {
    const selectedSeverity = changeSeverityFilters[message.id] || 'all';
    const pendingChanges = (message.fileChanges || [])
      .map((change) => ({ ...change, severity: normalizeSeverity(change.severity) }))
      .filter((change) => (
        selectedSeverity === 'all' || change.severity === selectedSeverity
      ))
      .filter((change) => !(message.appliedFilePaths || []).includes(change.path));

    for (const change of pendingChanges) {
      // eslint-disable-next-line no-await-in-loop
      await handleApplyOne(message.id, change);
    }
  }, [changeSeverityFilters, handleApplyOne]);

  return (
    <div className="ai" id="ai-chat">
      <div className="ai__header">
        <div className="ai__header-left">
          <div className="ai__header-badge">
            <span className="material-symbols-rounded ai__header-icon">smart_toy</span>
          </div>
          <div className="ai__header-copy">
            <span className="ai__header-title">AI Assistant</span>
            <span className="ai__header-subtitle">Project-aware review, fixes, and docs</span>
          </div>
        </div>

        <div className="ai__header-right">
          <label className="ai__answer-count" title="Ask the model for multiple answers">
            <span>Answers</span>
            <select
              value={answerCount}
              onChange={(event) => onAnswerCountChange?.(Number(event.target.value))}
              disabled={isLoading}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>

          <button
            className="ai__icon-action"
            onClick={onNewChat}
            title="Start New Chat"
            type="button"
          >
            <span className="material-symbols-rounded">chat_add_on</span>
          </button>

          <button
            className="ai__icon-action"
            onClick={onShowHistory}
            title="Conversation History"
            type="button"
          >
            <span className="material-symbols-rounded">history</span>
          </button>

          {modifiedFilesCount > 0 && (
            <button
              className="ai__push-btn"
              onClick={onPushClick}
              id="push-changes-btn"
              style={{ background: projectType === 'local' ? 'var(--accent-primary)' : '' }}
              type="button"
            >
              <span className="material-symbols-rounded">
                {projectType === 'local' ? 'folder_zip' : 'cloud_upload'}
              </span>
              <span>{projectType === 'local' ? 'Download ZIP' : 'Push'} ({modifiedFilesCount})</span>
            </button>
          )}
        </div>
      </div>

      <div className="ai__modes" role="tablist" aria-label="Whole project analysis modes">
        {PROJECT_ANALYSIS_MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className="ai__mode-pill"
            onClick={() => onRunProjectAnalysis(mode.key)}
            disabled={isLoading || !hasProject}
            title={hasProject ? mode.prompt : 'Load a project to run whole-project analysis.'}
          >
            <span className="material-symbols-rounded">{mode.icon}</span>
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      <div className="ai__messages">
        {messages.length === 0 && !isLoading && (
          <div className="ai__welcome">
            <div className="ai__welcome-icon">
              <span className="material-symbols-rounded">auto_awesome</span>
            </div>
            <h3>AI Coding Assistant</h3>
            <p>Ask me to review, edit, refactor, or explain your code. Use the mode bar to scan the whole project, or open files when you want apply-ready changes.</p>
            <div className="ai__suggestions">
              {[
                { text: 'Analyze the whole project for bugs and risks', icon: 'bug_report' },
                { text: 'Perform a whole-project security audit', icon: 'shield_lock' },
                { text: 'Write unit tests for this project', icon: 'science' },
                { text: 'Write a detailed project report that I can export to PDF', icon: 'assignment' },
                { text: 'Generate architecture documentation for this project', icon: 'account_tree' },
                { text: 'Refactor the open files and give me apply-ready changes', icon: 'build' },
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  className="ai__suggestion"
                  onClick={() => {
                    setInput(suggestion.text);
                    inputRef.current?.focus();
                  }}
                  type="button"
                >
                  <span className="material-symbols-rounded">{suggestion.icon}</span>
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const appliedFilePaths = message.appliedFilePaths || [];
          const fileChanges = (message.fileChanges || []).map((change) => ({
            ...change,
            severity: normalizeSeverity(change.severity),
          }));
          const reportAsset = message.reportAsset || null;
          const responseCandidates = message.responseCandidates || [];
          const selectedCandidateIndex = message.selectedCandidateIndex || 0;
          const selectedSeverity = changeSeverityFilters[message.id] || 'all';
          const filteredFileChanges = selectedSeverity === 'all'
            ? fileChanges
            : fileChanges.filter((change) => change.severity === selectedSeverity);
          const visiblePendingChanges = filteredFileChanges.filter(
            (change) => !appliedFilePaths.includes(change.path),
          );

          return (
            <div key={message.id} className={`ai__msg ai__msg--${message.role}`}>
              <div className="ai__msg-avatar">
                {message.role === 'user' ? (
                  <span className="material-symbols-rounded">person</span>
                ) : (
                  <span className="material-symbols-rounded">smart_toy</span>
                )}
              </div>

              <div className="ai__msg-body">
                <div className="ai__msg-header">
                  <span className="ai__msg-name">{message.role === 'user' ? 'You' : 'AI Assistant'}</span>
                  {message.role === 'assistant'
                    && !message.loading
                    && message.content?.trim()
                    && onDownloadPdf
                    && reportAsset && (
                    <button
                      type="button"
                      className="ai__message-action"
                      onClick={() => onDownloadPdf(message)}
                      title="Download as PDF"
                    >
                      <span className="material-symbols-rounded">picture_as_pdf</span>
                      <span>Download</span>
                    </button>
                  )}
                </div>

                <div className="ai__msg-content">
                  {!message.loading && responseCandidates.length > 1 && (
                    <div className="ai__candidate-tabs" role="tablist" aria-label="Assistant answer choices">
                      {responseCandidates.map((candidate) => (
                        <button
                          key={candidate.index}
                          type="button"
                          role="tab"
                          aria-selected={candidate.index === selectedCandidateIndex}
                          className={`ai__candidate-tab ${candidate.index === selectedCandidateIndex ? 'ai__candidate-tab--active' : ''}`}
                          onClick={() => onSelectCandidate?.(message.id, candidate.index)}
                        >
                          <span className="material-symbols-rounded">
                            {candidate.index === selectedCandidateIndex ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Answer {candidate.index + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {message.loading ? <TypingIndicator /> : renderContent(message.content)}

                  {reportAsset && (
                    <div className="ai__download-card">
                      <div className="ai__download-copy">
                        <span className="ai__download-kicker">{reportAsset.readyLabel || 'Your file is ready'}</span>
                        <strong className="ai__download-title">{reportAsset.title}</strong>
                        <p className="ai__download-description">
                          {reportAsset.description || 'This report is ready to download as a PDF.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ai__download-btn"
                        onClick={() => onDownloadPdf(message)}
                      >
                        <span className="material-symbols-rounded">download</span>
                        <span>{reportAsset.ctaLabel || 'Download PDF'}</span>
                      </button>
                    </div>
                  )}

                  {fileChanges.length > 0 && (
                    <div className="ai__changes">
                      <div className="ai__changes-header">
                        <div>
                          <span className="ai__changes-title">Proposed file changes</span>
                          <p className="ai__changes-subtitle">
                            These actions are structured outputs from the assistant, with severity attached to each change.
                          </p>
                        </div>

                        <div className="ai__changes-controls">
                          <label className="ai__severity-filter">
                            <span>Severity</span>
                            <select
                              value={selectedSeverity}
                              onChange={(event) => {
                                const value = event.target.value;
                                setChangeSeverityFilters((prev) => ({ ...prev, [message.id]: value }));
                              }}
                            >
                              <option value="all">All ({fileChanges.length})</option>
                              {SEVERITY_ORDER.map((severity) => {
                                const count = fileChanges.filter((change) => change.severity === severity).length;
                                return (
                                  <option key={severity} value={severity}>
                                    {SEVERITY_LABELS[severity]} ({count})
                                  </option>
                                );
                              })}
                            </select>
                          </label>

                          {visiblePendingChanges.length > 0 && (
                            <button
                              type="button"
                              className="ai__apply-all"
                              onClick={() => handleApplyAll(message)}
                            >
                              <span className="material-symbols-rounded">done_all</span>
                              Apply All
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="ai__changes-list">
                        {filteredFileChanges.length === 0 && (
                          <div className="ai__changes-empty">
                            No proposed changes match the selected severity.
                          </div>
                        )}

                        {filteredFileChanges.map((change) => {
                          const key = `${message.id}:${change.path}`;
                          return (
                            <FileChangeCard
                              key={key}
                              messageId={message.id}
                              change={change}
                              isApplied={appliedFilePaths.includes(change.path)}
                              isApplying={Boolean(applyingKeys[key])}
                              error={applyErrors[key]}
                              onApplyOne={handleApplyOne}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <form className="ai__input-form" onSubmit={handleSubmit}>
        {activeFilePath && (
          <div className="ai__input-context">
            <span className="material-symbols-rounded">description</span>
            <span>{activeFilePath.split('/').pop()}</span>
          </div>
        )}

        <div className="ai__input-row">
          <textarea
            ref={inputRef}
            className="ai__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code..."
            rows={1}
            disabled={isLoading}
            id="chat-input"
          />
          <button
            type="submit"
            className="ai__send-btn"
            disabled={!input.trim() || isLoading}
            title="Send message"
            id="send-message-btn"
          >
            <span className="material-symbols-rounded">
              {isLoading ? 'hourglass_empty' : 'send'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
