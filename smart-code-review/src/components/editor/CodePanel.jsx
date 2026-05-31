import { LANGUAGES, MODE_MAP } from '../../constants/modes';

export default function CodePanel({ code, setCode, language, setLanguage, onAnalyze, mode, isLoading }) {
  const lineCount = code.split('\n').length;
  const modeInfo = MODE_MAP[mode];

  return (
    <div className="ml__code-panel">
      <div className="ml__code-toolbar">
        <div className="ml__code-toolbar-left">
          <span className="material-symbols-rounded ml__code-toolbar-icon">code</span>
          <span className="ml__code-toolbar-title">Éditeur de code</span>
          <span className="ml__code-lines-count">
            {lineCount} ligne{lineCount > 1 ? 's' : ''}
          </span>
        </div>
        <div className="ml__code-toolbar-right">
          <select
            className="ml__lang-select"
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            <option value="">Langage auto</option>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="ml__code-clear" onClick={() => setCode('')} title="Effacer">
            <span className="material-symbols-rounded">delete_sweep</span>
          </button>
        </div>
      </div>

      <div className="ml__editor-wrap">
        <div className="ml__line-numbers" aria-hidden="true">
          {code.split('\n').map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          className="ml__editor"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={`// Collez ou saisissez votre code ici…\n// Exemple :\nfunction calculateTotal(items) {\n  let total = 0;\n  for(let i = 0; i < items.length; i++) {\n    total += items[i].price * items[i].qty;\n  }\n  return total;\n}`}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      <button
        className={`ml__analyze-btn ${isLoading ? 'ml__analyze-btn--loading' : ''}`}
        onClick={onAnalyze}
        disabled={isLoading || !code.trim()}
      >
        {isLoading ? (
          <>
            <span className="ml__analyze-spinner" />
            Analyse en cours…
          </>
        ) : (
          <>
            <span className="material-symbols-rounded">
              {modeInfo?.icon || 'play_arrow'}
            </span>
            {modeInfo?.label || 'Analyser'}
          </>
        )}
      </button>
    </div>
  );
}

