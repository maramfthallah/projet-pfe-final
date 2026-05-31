import { useState, useEffect, useRef } from 'react';
import './VoicePage.css';

const VOICE_HISTORY = [
  { id: 'v1', title: 'Analyse de performance React', duration: '02:34', date: "Aujourd'hui", size: '1.2 Mo' },
  { id: 'v2', title: 'Revue de code backend',        duration: '04:12', date: "Aujourd'hui", size: '2.1 Mo' },
  { id: 'v3', title: 'Brief projet dashboard',       duration: '01:47', date: 'Hier',        size: '0.9 Mo' },
  { id: 'v4', title: 'Questions sur TypeScript',     duration: '03:20', date: 'Hier',        size: '1.6 Mo' },
  { id: 'v5', title: 'Architecture API REST',        duration: '05:08', date: 'Lun 20 jan',  size: '2.5 Mo' },
];

function WaveBar({ active, index }) {
  return (
    <div
      className={`vp__wave-bar ${active ? 'vp__wave-bar--active' : ''}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    />
  );
}

export default function VoicePage() {
  const [isRecording, setIsRecording]  = useState(false);
  const [isPaused,    setIsPaused]     = useState(false);
  const [recTime,     setRecTime]      = useState(0);
  const [phase,       setPhase]        = useState('idle'); // idle | recording | processing | result
  const [transcript,  setTranscript]   = useState('');
  const [activeVoice, setActiveVoice]  = useState(null);
  const [isPlaying,   setIsPlaying]    = useState(false);
  const timerRef = useRef(null);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startRec = () => {
    setPhase('recording'); setIsRecording(true); setIsPaused(false);
    setRecTime(0); setTranscript('');
    timerRef.current = setInterval(() => setRecTime(p => p + 1), 1000);
  };

  const pauseRec = () => {
    setIsPaused(v => !v);
    if (!isPaused) clearInterval(timerRef.current);
    else timerRef.current = setInterval(() => setRecTime(p => p + 1), 1000);
  };

  const stopRec = () => {
    clearInterval(timerRef.current);
    setIsRecording(false); setPhase('processing');
    setTimeout(() => {
      setPhase('result');
      setTranscript("Bonjour, je voudrais analyser les performances de notre composant React Dashboard. On a des re-renders qui semblent excessifs, notamment sur la partie graphiques. Est-ce que tu peux m'expliquer comment identifier et corriger ça efficacement ?");
    }, 2200);
  };

  const reset = () => { setPhase('idle'); setRecTime(0); setTranscript(''); };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const BARS = 32;

  return (
    <div className="vp">

      {/* ── HEADER ── */}
      <div className="vp__header">
        <div className="vp__header-info">
          <div className="vp__header-icon">
            <span className="material-symbols-rounded">mic</span>
          </div>
          <div>
            <h2 className="vp__header-title">Assistant Vocal</h2>
            <span className="vp__header-sub">Parlez pour interagir avec l'IA</span>
          </div>
        </div>
        <div className="vp__header-actions">
          <button className="vp__hdr-btn">
            <span className="material-symbols-rounded">settings</span>
            Paramètres audio
          </button>
        </div>
      </div>

      <div className="vp__body">

        {/* ── PANNEAU PRINCIPAL ── */}
        <div className="vp__main">

          {/* Zone d'enregistrement */}
          <div className={`vp__recorder vp__recorder--${phase}`}>

            {/* Visualiseur de vague */}
            <div className="vp__visualizer">
              {Array.from({ length: BARS }).map((_, i) => (
                <WaveBar key={i} active={phase === 'recording' && !isPaused} index={i} />
              ))}
            </div>

            {/* Indicateur de phase */}
            {phase === 'idle' && (
              <div className="vp__phase">
                <div className="vp__phase-icon">
                  <span className="material-symbols-rounded">mic</span>
                  <div className="vp__phase-ring vp__phase-ring--1" />
                  <div className="vp__phase-ring vp__phase-ring--2" />
                </div>
                <h3>Prêt à enregistrer</h3>
                <p>Cliquez sur le bouton pour démarrer</p>
              </div>
            )}
            {phase === 'recording' && (
              <div className="vp__phase">
                <div className="vp__rec-timer">
                  <span className="vp__rec-dot" />
                  <span className="vp__rec-time">{fmt(recTime)}</span>
                  {isPaused && <span className="vp__pause-badge">En pause</span>}
                </div>
                <p className="vp__rec-hint">
                  {isPaused ? 'Enregistrement en pause' : 'Parlez maintenant…'}
                </p>
              </div>
            )}
            {phase === 'processing' && (
              <div className="vp__phase">
                <div className="vp__processing">
                  <div className="vp__processing-ring" />
                  <span className="material-symbols-rounded">psychology</span>
                </div>
                <h3>Traitement en cours…</h3>
                <p>Transcription et analyse de votre message</p>
              </div>
            )}
            {phase === 'result' && (
              <div className="vp__result">
                <div className="vp__result-header">
                  <span className="material-symbols-rounded vp__result-ico">check_circle</span>
                  <div>
                    <h4>Transcription terminée</h4>
                    <span>{fmt(recTime)} · {(transcript.length / 5).toFixed(0)} mots environ</span>
                  </div>
                </div>
                <div className="vp__transcript">
                  <p>{transcript}</p>
                </div>
                <div className="vp__result-actions">
                  <button className="vp__res-btn vp__res-btn--primary">
                    <span className="material-symbols-rounded">send</span>
                    Envoyer au chat
                  </button>
                  <button className="vp__res-btn" onClick={reset}>
                    <span className="material-symbols-rounded">refresh</span>
                    Recommencer
                  </button>
                  <button className="vp__res-btn">
                    <span className="material-symbols-rounded">content_copy</span>
                    Copier
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Contrôles */}
          <div className="vp__controls">
            {phase === 'idle' && (
              <button className="vp__ctrl-btn vp__ctrl-btn--start" onClick={startRec}>
                <span className="material-symbols-rounded">mic</span>
                Démarrer l'enregistrement
              </button>
            )}
            {phase === 'recording' && (
              <>
                <button className="vp__ctrl-btn vp__ctrl-btn--pause" onClick={pauseRec}>
                  <span className="material-symbols-rounded">{isPaused ? 'play_arrow' : 'pause'}</span>
                  {isPaused ? 'Reprendre' : 'Pause'}
                </button>
                <button className="vp__ctrl-btn vp__ctrl-btn--stop" onClick={stopRec}>
                  <span className="material-symbols-rounded">stop</span>
                  Terminer
                </button>
              </>
            )}
            {(phase === 'processing' || phase === 'result') && phase !== 'result' && (
              <div className="vp__ctrl-waiting">
                <div className="vp__ctrl-spinner" />
                Traitement en cours…
              </div>
            )}
          </div>

          {/* Infos modèle */}
          <div className="vp__info-cards">
            <div className="vp__info-card">
              <span className="material-symbols-rounded">language</span>
              <div>
                <p>Langue</p>
                <span>Français · Auto-détection</span>
              </div>
            </div>
            <div className="vp__info-card">
              <span className="material-symbols-rounded">hearing</span>
              <div>
                <p>Modèle</p>
                <span>Whisper Large v3</span>
              </div>
            </div>
            <div className="vp__info-card">
              <span className="material-symbols-rounded">speed</span>
              <div>
                <p>Mode</p>
                <span>Temps réel</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SIDEBAR HISTORIQUE ── */}
        <div className="vp__sidebar">
          <div className="vp__sb-header">
            <h3>Historique vocal</h3>
            <button className="vp__sb-btn">
              <span className="material-symbols-rounded">filter_list</span>
            </button>
          </div>

          <ul className="vp__history">
            {VOICE_HISTORY.map(item => (
              <li key={item.id}>
                <button
                  className={`vp__hist-item ${activeVoice === item.id ? 'vp__hist-item--active' : ''}`}
                  onClick={() => { setActiveVoice(item.id); setIsPlaying(false); }}
                >
                  <div className="vp__hist-icon">
                    <span className="material-symbols-rounded">
                      {activeVoice === item.id && isPlaying ? 'graphic_eq' : 'mic'}
                    </span>
                  </div>
                  <div className="vp__hist-info">
                    <p className="vp__hist-title">{item.title}</p>
                    <div className="vp__hist-meta">
                      <span>{item.duration}</span>
                      <span>·</span>
                      <span>{item.size}</span>
                      <span>·</span>
                      <span>{item.date}</span>
                    </div>
                  </div>
                  {activeVoice === item.id && (
                    <button
                      className="vp__hist-play"
                      onClick={e => { e.stopPropagation(); setIsPlaying(v => !v); }}
                    >
                      <span className="material-symbols-rounded">
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}