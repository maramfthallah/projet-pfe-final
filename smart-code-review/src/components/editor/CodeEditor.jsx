import { useRef, useEffect, useCallback } from 'react';
import { getIconFromPath, getColorFromPath, getLangFromPath } from '../../constants/modes';
import './CodeEditor.css';

/* ═══════════════════════════════════════════
   CODE EDITOR — Tabbed code editor with line numbers
═══════════════════════════════════════════ */
export default function CodeEditor({
  openFiles = [],
  activeFilePath,
  onSelectTab,
  onCloseTab,
  fileContents = {},
  onFileChange,
  modifiedFiles = new Set(),
}) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const activeContent = fileContents[activeFilePath] || '';
  const language = activeFilePath ? getLangFromPath(activeFilePath) : '';

  // Sync line numbers with textarea scroll
  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Calculate line numbers
  const lineCount = activeContent.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Auto-resize on content change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = 0;
    }
  }, [activeFilePath]);

  // Handle tab keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = activeContent.substring(0, start) + '  ' + activeContent.substring(end);
      onFileChange(activeFilePath, newContent);

      // Restore cursor position
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [activeContent, activeFilePath, onFileChange]);

  /* ─── No file open ─── */
  if (!activeFilePath || openFiles.length === 0) {
    return (
      <div className="ce" id="code-editor">
        <div className="ce__empty">
          <div className="ce__empty-icon">
            <span className="material-symbols-rounded">code</span>
          </div>
          <h2 className="ce__empty-title">No File Open</h2>
          <p className="ce__empty-desc">
            Select a file from the explorer to start editing, or connect a GitHub repository.
          </p>
          <div className="ce__empty-shortcuts">
            <div className="ce__shortcut">
              <kbd>Click</kbd> a file in the explorer to open it
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ce" id="code-editor">
      {/* ─── Tab Bar ─── */}
      <div className="ce__tabs">
        <div className="ce__tabs-scroll">
          {openFiles.map(filePath => {
            const fileName = filePath.split('/').pop();
            const isActive = filePath === activeFilePath;
            const isModified = modifiedFiles.has(filePath);
            const icon = getIconFromPath(fileName);
            const color = getColorFromPath(fileName);

            return (
              <button
                key={filePath}
                className={`ce__tab ${isActive ? 'ce__tab--active' : ''} ${isModified ? 'ce__tab--modified' : ''}`}
                onClick={() => onSelectTab(filePath)}
                title={filePath}
                id={`tab-${fileName}`}
              >
                <span className="material-symbols-rounded ce__tab-icon" style={{ color }}>
                  {icon}
                </span>
                <span className="ce__tab-name">{fileName}</span>
                {isModified && <span className="ce__tab-dot" />}
                <button
                  className="ce__tab-close"
                  onClick={(e) => { e.stopPropagation(); onCloseTab(filePath); }}
                  title="Close"
                >
                  <span className="material-symbols-rounded">close</span>
                </button>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Editor Area ─── */}
      <div className="ce__editor-area">
        {/* Breadcrumb */}
        <div className="ce__breadcrumb">
          {activeFilePath.split('/').map((part, i, arr) => (
            <span key={i}>
              <span className={i === arr.length - 1 ? 'ce__breadcrumb-active' : 'ce__breadcrumb-part'}>
                {part}
              </span>
              {i < arr.length - 1 && <span className="ce__breadcrumb-sep">/</span>}
            </span>
          ))}
          <span className="ce__breadcrumb-lang">{language}</span>
        </div>

        {/* Code editor with line numbers */}
        <div className="ce__code-container">
          <div className="ce__line-numbers" ref={lineNumbersRef}>
            {lineNumbers.map(n => (
              <div key={n} className="ce__line-num">{n}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="ce__textarea"
            value={activeContent}
            onChange={(e) => onFileChange(activeFilePath, e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            id="code-textarea"
          />
        </div>
      </div>

      {/* ─── Status Bar ─── */}
      <div className="ce__status">
        <div className="ce__status-left">
          <span>{language}</span>
          <span className="ce__status-sep">·</span>
          <span>{lineCount} lines</span>
          <span className="ce__status-sep">·</span>
          <span>{activeContent.length} chars</span>
        </div>
        <div className="ce__status-right">
          {modifiedFiles.has(activeFilePath) && (
            <span className="ce__status-modified">Modified</span>
          )}
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
