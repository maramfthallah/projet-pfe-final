import { useState, useRef, useEffect, useCallback, Component } from 'react';
import './mainLayout.css';

import { ANALYSIS_MODES, MODE_MAP, EXT_TO_LANG, CODE_FILE_EXTENSIONS } from '../../constants/modes';
import { callLLM, analysisAPI } from '../../utils/api';
import { detectLanguage } from '../chat/ChatInput';

// import WelcomeScreen from '../welcome/WelcomeScreen'; // commenté — on bypass le welcome
import CodePanel from '../editor/CodePanel';
import Message from '../chat/Message';
import ChatInput from '../chat/ChatInput';

/* ══════════════════════════════════════
   ERROR BOUNDARY
══════════════════════════════════════ */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          color: 'var(--color-error, #f87171)',
          fontFamily: 'monospace',
          background: 'var(--color-surface, #1e1e2e)',
          borderRadius: '8px',
          margin: '1rem',
        }}>
          <strong>❌ Une erreur est survenue dans l'interface.</strong>
          <pre style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'var(--color-primary, #7c3aed)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ══════════════════════════════════════
   HELPER — msg.content toujours string
══════════════════════════════════════ */
function safeMsg(msg) {
  return {
    ...msg,
    content: typeof msg.content === 'string'
      ? msg.content
      : msg.content != null ? String(msg.content) : '',
  };
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function MainLayout({ user, onRequireLogin, selectedAnalysisId, onClearSession }) {
  // Initialiser avec 'chat' pour bypasser le WelcomeScreen
  const [activeMode,   setActiveMode]   = useState('chat');
  const [code,         setCode]         = useState('');
  const [language,     setLanguage]     = useState('');
  const [message,      setMessage]      = useState('');
  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRecording,  setIsRecording]  = useState(false);
  const [recTime,      setRecTime]      = useState(0);
  const [showCode,     setShowCode]     = useState(true);

  const manualLangRef = useRef(false);
  const mediaRecRef   = useRef(null);
  const timerRef      = useRef(null);
  const bottomRef     = useRef(null);
  const messagesRef   = useRef([]);
  const languageRef   = useRef('');
  const activeModeRef = useRef(null);
  const codeRef       = useRef('');

  useEffect(() => { messagesRef.current   = messages;   }, [messages]);
  useEffect(() => { languageRef.current   = language;   }, [language]);
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { codeRef.current       = code;       }, [code]);

  /* Auto-détection du langage quand le code change */
  useEffect(() => {
    if (!code.trim()) {
      if (!manualLangRef.current) setLanguage('');
      return;
    }
    if (manualLangRef.current) return;
    const detected = detectLanguage(code);
    if (detected) setLanguage(detected);
  }, [code]);

  /* scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* cleanup on unmount */
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      try {
        if (mediaRecRef.current?.state !== 'inactive') mediaRecRef.current?.stop();
      } catch (_) {}
    };
  }, []);

  const handleSetLanguage = useCallback((lang) => {
    manualLangRef.current = true;
    setLanguage(lang);
  }, []);

  const handleSetCode = useCallback((newCode) => {
    manualLangRef.current = false;
    setCode(newCode);
  }, []);

  /* ── Load Old Analysis ── */
  useEffect(() => {
    if (!selectedAnalysisId) return;
    setIsLoading(true);
    analysisAPI.getById(selectedAnalysisId)
      .then(res => {
        if (res.data?.success && res.data.analysis) {
          const a = res.data.analysis;
          setActiveMode(a.mode || 'chat');
          handleSetCode(a.code || '');
          if (a.language) handleSetLanguage(a.language);
          const msgContent = typeof a.result === 'string' ? a.result : a.result?.rawText || JSON.stringify(a.result);
          setMessages([{ id: Date.now(), role: 'assistant', content: msgContent, mode: a.mode }]);
          if (window.innerWidth < 900) setShowCode(false);
        }
      })
      .catch(err => console.error("Erreur chargement analyse:", err))
      .finally(() => setIsLoading(false));
  }, [selectedAnalysisId, handleSetCode, handleSetLanguage]);

  /* ── Clear Workspace ── */
  useEffect(() => {
    if (selectedAnalysisId === null) {
      handleSetCode('');
      handleSetLanguage('');
      setMessages([]);
      setSelectedFile(null);
      // On reste sur le mode actuel (pas de retour au WelcomeScreen)
    }
  }, [selectedAnalysisId, handleSetCode, handleSetLanguage]);

  /* ── Send to LLM ── */
  const sendToLLM = useCallback(async (userContent, mode, userMsg) => {
    if (!userContent || typeof userContent !== 'string') return;
    if (!userMsg || typeof userMsg !== 'object') return;

    const loadingId  = Date.now() + 1;
    const loadingMsg = { id: loadingId, role: 'assistant', content: '', loading: true, mode: mode || 'chat' };

    setMessages(prev => [...prev, safeMsg(userMsg), loadingMsg]);
    setIsLoading(true);

    try {
      const aiText = await callLLM(userContent, mode || 'chat', languageRef.current, messagesRef.current);
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, content: typeof aiText === 'string' ? aiText : String(aiText ?? 'Aucune réponse.'), loading: false }
            : m,
        ),
      );
    } catch (err) {
      console.error('[sendToLLM]', err);
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, content: `❌ Erreur : ${err?.message ?? 'Inconnue'}`, loading: false }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ── File import ── */
  const handleFileChange = useCallback(async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setSelectedFile(file);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (CODE_FILE_EXTENSIONS.includes(ext)) {
        const text = await file.text();
        manualLangRef.current = false;
        setCode(text);
        if (EXT_TO_LANG[ext]) { manualLangRef.current = true; setLanguage(EXT_TO_LANG[ext]); }
      }
    } catch (err) {
      console.error('[handleFileChange]', err);
    } finally {
      e.target.value = '';
    }
  }, []);

  /* ── Language detect ── */
  const handleLanguageDetect = useCallback((detected) => {
    if (detected && typeof detected === 'string' && !manualLangRef.current) {
      setLanguage(prev => prev || detected);
    }
  }, []);

  /* ── Voice recording ── */
  const stopRecording = useCallback(() => {
    try {
      if (mediaRecRef.current?.state !== 'inactive') mediaRecRef.current?.stop();
    } catch (err) {
      console.error('[stopRecording]', err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        setIsRecording(false);
        setRecTime(0);
        clearInterval(timerRef.current);
        stream.getTracks().forEach(t => t.stop());
        const currentCode = codeRef.current ?? '';
        const currentLang = languageRef.current ?? '';
        const currentMode = activeModeRef.current;
        const userMsg = { id: Date.now(), role: 'user', content: '🎤 Message vocal' };
        const fullContent = currentCode.trim()
          ? `[Message vocal + code]\n\`\`\`${currentLang}\n${currentCode}\n\`\`\`\n\nRéponds en français.`
          : `[Message vocal de l'utilisateur — réponds en français]`;
        sendToLLM(fullContent, currentMode || 'chat', userMsg);
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecTime(p => { if (p >= 179) { stopRecording(); return 0; } return p + 1; });
      }, 1000);
    } catch (err) {
      console.error('[startRecording]', err);
      alert("Impossible d'accéder au microphone.");
    }
  }, [stopRecording, sendToLLM]);

  /* ── Analyze code ── */
  const handleAnalyze = useCallback(async () => {
    const currentCode = codeRef.current ?? '';
    const currentLang = languageRef.current ?? '';
    const currentMode = activeModeRef.current;
    if (!currentCode.trim() || isLoading) return;
    const userContent = `${currentLang ? `[Langage: ${currentLang}]\n` : ''}${currentCode}`;
    const userMsg = { id: Date.now(), role: 'user', content: '', code: true, language: currentLang || 'Auto-détecté', lines: currentCode.split('\n').length };
    if (window.innerWidth < 900) setShowCode(false);
    await sendToLLM(userContent, currentMode, userMsg);
  }, [isLoading, sendToLLM]);

  /* ── Chat submit ── */
  const handleChatSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const text = message.trim();
    if (!text && !selectedFile) {
      isRecording ? stopRecording() : startRecording();
      return;
    }
    if (isLoading) return;
    const currentCode = codeRef.current ?? '';
    const currentLang = languageRef.current ?? '';
    const currentMode = activeModeRef.current;
    const userMsg = { id: Date.now(), role: 'user', content: text || `[Fichier : ${selectedFile?.name ?? 'inconnu'}]`, file: selectedFile?.name ?? null };
    setMessage('');
    setSelectedFile(null);
    const fullContent = currentCode.trim()
      ? `[Question sur ce code]\n\`\`\`${currentLang}\n${currentCode}\n\`\`\`\n\n${text}`
      : text;
    await sendToLLM(fullContent, currentMode || 'chat', userMsg);
  }, [message, selectedFile, isLoading, isRecording, sendToLLM, stopRecording, startRecording]);

  // WelcomeScreen supprimé — on affiche directement le workspace
  // if (!activeMode) { return <WelcomeScreen ... /> }

  const currentMode = MODE_MAP[activeMode];

  /* ── Workspace ── */
  return (
    <div className="ml ml--workspace">
      <div className="ml__bg" aria-hidden="true" />

      {/* Top bar */}
      <div className="ml__topbar">
        <div className="ml__topbar-left">
          {/* Bouton back supprimé — pas de WelcomeScreen vers lequel revenir */}
          {/* <button className="ml__back-btn" onClick={...}>...</button> */}

          <div className="ml__mode-tabs">
            {ANALYSIS_MODES.map(m => (
              <button
                key={m.id}
                className={`ml__mode-tab ${activeMode === m.id ? 'ml__mode-tab--active' : ''}`}
                onClick={() => setActiveMode(m.id)}
                title={m.desc}
              >
                <span className="material-symbols-rounded">{m.icon}</span>
                <span className="ml__mode-tab-label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ml__topbar-right">
          {activeMode !== 'chat' && activeMode !== 'voice' && (
            <button
              className={`ml__toggle-code ${showCode ? 'ml__toggle-code--active' : ''}`}
              onClick={() => setShowCode(v => !v)}
              title={showCode ? "Masquer l'éditeur" : "Afficher l'éditeur"}
            >
              <span className="material-symbols-rounded">code</span>
              <span>Éditeur</span>
            </button>
          )}
          {activeMode !== 'voice' && (
            <button
              className="ml__clear-btn"
              onClick={() => setMessages([])}
              title="Effacer la conversation"
              disabled={messages.length === 0}
            >
              <span className="material-symbols-rounded">delete_sweep</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="ml__body">
        {activeMode === 'voice' ? (
          <ErrorBoundary>
            {/* <VoicePage /> */}
          </ErrorBoundary>
        ) : (
          <>
            {activeMode !== 'chat' && showCode && (
              <ErrorBoundary>
                <CodePanel
                  code={code}
                  setCode={handleSetCode}
                  language={language}
                  setLanguage={handleSetLanguage}
                  onAnalyze={handleAnalyze}
                  mode={activeMode}
                  isLoading={isLoading}
                />
              </ErrorBoundary>
            )}

            <div className="ml__results">
              <div className="ml__messages">
                {messages.length === 0 && (
                  <div className="ml__results-empty">
                    <div className="ml__results-empty-icon">
                      <span className="material-symbols-rounded">{currentMode?.icon}</span>
                    </div>
                    <p>{currentMode?.label}</p>
                    <span>
                      {activeMode === 'chat'
                        ? 'Posez votre question ci-dessous'
                        : "Collez votre code et lancez l'analyse"}
                    </span>
                  </div>
                )}

                {messages.map(msg => (
                  <ErrorBoundary key={msg.id}>
                    <Message msg={safeMsg(msg)} />
                  </ErrorBoundary>
                ))}

                <div ref={bottomRef} />
              </div>

              <ErrorBoundary>
                <ChatInput
                  message={message}
                  setMessage={setMessage}
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  isRecording={isRecording}
                  isLoading={isLoading}
                  activeMode={activeMode}
                  recTime={recTime}
                  onSubmit={handleChatSubmit}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onFileChange={handleFileChange}
                  onLanguageDetect={handleLanguageDetect}
                />
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
    </div>
  );
}