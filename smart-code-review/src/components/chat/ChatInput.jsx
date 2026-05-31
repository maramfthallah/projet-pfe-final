import { useRef, useEffect, useCallback } from 'react';
import { formatTime } from '../../utils/markdown';

/* ══════════════════════════════════════
   LANGUAGE DETECTION
   Keys must match EXT_TO_LANG values exactly:
   'JavaScript' | 'TypeScript' | 'Python' | 'Java'
   'C#' | 'C++' | 'Go' | 'Rust' | 'PHP' | 'Ruby'
══════════════════════════════════════ */
const LANG_PATTERNS = [
  {
    lang: 'TypeScript',   // must come BEFORE JavaScript
    patterns: [
      /:\s*(string|number|boolean|any|void|never|unknown)\b/,
      /interface\s+\w+\s*\{/,
      /type\s+\w+\s*=/,
      /<\w+>\(|Array<|Promise<|Record</,
      /as\s+(string|number|boolean|any)\b/,
      /\?\s*:\s*\w+/,         // optional chaining types
    ],
  },
  {
    lang: 'JavaScript',
    patterns: [
      /\bconst\b|\blet\b|\bvar\b/,
      /=>\s*\{|=>\s*\(/,
      /\bconsole\.log\b/,
      /import\s+.+\s+from\s+['"`]/,
      /export\s+default\b/,
      /document\.|window\.|addEventListener/,
      /useState|useEffect|useRef/,
    ],
  },
  {
    lang: 'Python',
    patterns: [
      /^def\s+\w+\s*\(/m,
      /^class\s+\w+[:(]/m,
      /^import\s+\w+|^from\s+\w+\s+import/m,
      /print\s*\(/,
      /if\s+__name__\s*==\s*['"]__main__['"]/,
      /\bself\b/,
      /:\s*$|\belif\b|\bNone\b|\bTrue\b|\bFalse\b/m,
    ],
  },
  {
    lang: 'Java',
    patterns: [
      /public\s+(class|static|void|int|String)\b/,
      /System\.out\.print/,
      /\bextends\b|\bimplements\b/,
      /new\s+\w+\s*\(/,
      /@Override|@Autowired|@Component|@SpringBootApplication/,
      /\bpublic\s+static\s+void\s+main\b/,
    ],
  },
  {
    lang: 'C#',
    patterns: [
      /using\s+System/,
      /namespace\s+\w+/,
      /Console\.Write(Line)?\s*\(/,
      /\bpublic\s+(class|static|void|int|string|bool)\b/,
      /\bvar\s+\w+\s*=.*new\b/,
      /List<|Dictionary<|IEnumerable</,
    ],
  },
  {
    lang: 'C++',
    patterns: [
      /#include\s*[<"]/,
      /std::|cout\s*<<|cin\s*>>/,
      /int\s+main\s*\(/,
      /printf\s*\(|scanf\s*\(/,
      /::\w+|nullptr|template\s*</,
      /\bvector<|\bmap<|\bstring\b/,
    ],
  },
  {
    lang: 'Go',
    patterns: [
      /^package\s+\w+/m,
      /func\s+\w+\s*\(/,
      /fmt\.Print/,
      /:=\s*/,
      /^import\s+\(/m,
      /\bgoroutine\b|\bchan\b|\bdefer\b/,
    ],
  },
  {
    lang: 'Rust',
    patterns: [
      /\bfn\s+\w+\s*\(/,
      /let\s+mut\s+\w+/,
      /println!\s*\(/,
      /use\s+std::/,
      /impl\s+\w+|trait\s+\w+/,
      /\bOption<|\bResult<|\bVec<|\bSome\(|\bNone\b/,
    ],
  },
  {
    lang: 'PHP',
    patterns: [
      /<\?php/,
      /\$\w+\s*=/,
      /echo\s+['"`]/,
      /->\w+\(|\$this->/,
      /function\s+\w+\s*\(\s*\$\w*/,
    ],
  },
  {
    lang: 'Ruby',
    patterns: [
      /\bdef\s+\w+/,
      /\bend\b/,
      /puts\s+['"`]/,
      /require\s+['"`]/,
      /\.each\s*do\s*\||\bdo\s*\|/,
      /attr_(accessor|reader|writer)/,
    ],
  },
];

/**
 * Detects programming language from code string.
 * Returns a value matching EXT_TO_LANG (e.g. 'JavaScript') or '' if unknown.
 */
export function detectLanguage(code) {
  if (!code || code.trim().length < 15) return '';

  const scores = {};
  for (const { lang, patterns } of LANG_PATTERNS) {
    scores[lang] = patterns.filter(re => re.test(code)).length;
  }

  const ranked = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!ranked.length) return '';

  // TypeScript must beat JavaScript by at least 1 point to win
  const [first] = ranked;
  if (
    first[0] === 'JavaScript' &&
    (scores['TypeScript'] ?? 0) >= (scores['JavaScript'] ?? 0)
  ) {
    return 'TypeScript';
  }

  return first[0];
}

/* ══════════════════════════════════════
   COMPONENT
══════════════════════════════════════ */
export default function ChatInput({
  message, setMessage,
  selectedFile, setSelectedFile,
  isRecording, isLoading,
  activeMode,
  onSubmit, onStartRecording, onStopRecording,
  onFileChange,
  onLanguageDetect,   // (lang: string) => void  — optional
  recTime,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  /* auto-grow textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [message]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }, [onSubmit]);

  /* detect language on change and notify parent */
  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setMessage(val);

    if (onLanguageDetect) {
      const detected = detectLanguage(val);
      if (detected) onLanguageDetect(detected);
    }
  }, [setMessage, onLanguageDetect]);

  const isEmpty = !message.trim() && !selectedFile;
  const mainIcon = isRecording ? 'stop' : isEmpty ? 'mic' : 'send';
  const btnVariant = isRecording ? 'ml__send--rec'
    : isLoading ? 'ml__send--loading'
    : isEmpty   ? 'ml__send--idle'
    : 'ml__send--ready';

  return (
    <div className="ml__footer">
      <div className="ml__form">
        {selectedFile && (
          <div className="ml__file-chip">
            <span className="material-symbols-rounded ml__chip-icon">description</span>
            <span className="ml__chip-name">{selectedFile.name}</span>
            <button className="ml__chip-remove" onClick={() => setSelectedFile(null)}>
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
        )}

        {isRecording && (
          <div className="ml__rec-pill">
            <span className="ml__rec-dot" />
            <span className="ml__rec-time">{formatTime(recTime)}</span>
            <span className="ml__rec-label">Enregistrement…</span>
          </div>
        )}

        <div className="ml__row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.js,.jsx,.ts,.tsx,.py,.java,.cs,.cpp,.go,.rs,.php,.rb"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          {!isRecording && (
            <button
              type="button"
              className="ml__attach"
              onClick={() => fileInputRef.current?.click()}
              title="Joindre un fichier"
            >
              <span className="material-symbols-rounded">attach_file</span>
            </button>
          )}
          <textarea
            ref={textareaRef}
            className="ml__textarea"
            rows={1}
            placeholder={
              isRecording ? ''
              : isLoading ? 'Analyse en cours…'
              : activeMode === 'chat' ? 'Posez votre question…'
              : "Question complémentaire sur l'analyse…"
            }
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isRecording || isLoading}
          />
          <button
            type="button"
            className={`ml__send ${btnVariant}`}
            onClick={onSubmit}
            disabled={isLoading && isEmpty}
          >
            {isLoading
              ? <span className="ml__send-spinner" />
              : <span className="material-symbols-rounded">{mainIcon}</span>}
          </button>
        </div>
      </div>

      <p className="ml__hint">
        <kbd>Entrée</kbd> pour envoyer · <kbd>Maj+Entrée</kbd> saut de ligne
        {activeMode !== 'chat' && <> · <kbd>Joindre</kbd> pour importer un fichier de code</>}
      </p>
    </div>
  );
}