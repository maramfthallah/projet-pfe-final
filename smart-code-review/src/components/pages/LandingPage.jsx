import React, { useState } from 'react';
import './LandingPage.css';

export default function LandingPage({
  user,
  showRegister,
  setShowRegister,
  authError,
  email,
  setEmail,
  password,
  setPassword,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  onLoginGitHub,
  onLoginGoogle,
  onLocalAuth,
  onForgotPassword,
}) {
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await onForgotPassword?.(forgotEmail);
    } catch (_) {}
    setForgotLoading(false);
    setForgotSent(true);
  };

  const backToLogin = () => {
    setShowForgot(false);
    setForgotSent(false);
    setForgotEmail('');
  };

  return (
    <div className="landing-container">
      {/* Background Elements */}
      <div className="landing-grid"></div>
      <div className="landing-bg-orb orb-1"></div>
      <div className="landing-bg-orb orb-2"></div>
      <div className="landing-bg-orb orb-3"></div>

      <div className="landing-content centered">
        <div className="landing-auth-wrapper">
          <div className="landing-auth-card">

            {/* ── FORGOT PASSWORD VIEW ── */}
            {showForgot ? (
              <>
                <div className="landing-auth-header">
                  <div className="brand-logo-big">
                    <span className="logo-symbol">⟡</span>
                  </div>
                  <h2>Mot de passe oublié</h2>
                  <p>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>

                {forgotSent ? (
                  <div className="auth-forgot-success">
                    <div className="auth-forgot-icon">✓</div>
                    <p className="auth-forgot-success-title">Email envoyé !</p>
                    <p className="auth-forgot-success-sub">
                      Vérifiez votre boîte mail et suivez le lien pour réinitialiser votre mot de passe.
                    </p>
                  </div>
                ) : (
                  <form className="auth-form" onSubmit={handleForgotSubmit}>
                    <input
                      type="email"
                      className="auth-input"
                      placeholder="vous@exemple.com"
                      required
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                    />
                    <button type="submit" className="auth-submit-btn" disabled={forgotLoading}>
                      {forgotLoading ? 'Envoi…' : 'Envoyer le lien'}
                    </button>
                  </form>
                )}

                <button className="auth-switch-btn" onClick={backToLogin} type="button">
                  ← Retour à la connexion
                </button>
              </>

            ) : (
              /* ── NORMAL LOGIN / REGISTER VIEW ── */
              <>
                <div className="landing-auth-header">
                  <div className="brand-logo-big">
                    <span className="logo-symbol">⟡</span>
                  </div>
                  <h2>Connexion</h2>
                  <p>Accédez à votre IDE intelligent</p>
                </div>

                {/* OAuth Buttons */}
                <button className="auth-btn auth-btn-github" onClick={onLoginGitHub}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Continuer avec GitHub
                </button>

                <button className="auth-btn auth-btn-google" onClick={onLoginGoogle}>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuer avec Google
                </button>

                <div className="auth-divider">
                  <div className="auth-divider-line" />
                  <span className="auth-divider-text">ou</span>
                  <div className="auth-divider-line" />
                </div>

                {authError && <div className="auth-error">{authError}</div>}

                <form className="auth-form" onSubmit={onLocalAuth}>
                  {showRegister && (
                    <div className="auth-input-group">
                      <input
                        type="text" className="auth-input" placeholder="Prénom" required
                        value={firstName} onChange={e => setFirstName(e.target.value)}
                      />
                      <input
                        type="text" className="auth-input" placeholder="Nom" required
                        value={lastName} onChange={e => setLastName(e.target.value)}
                      />
                    </div>
                  )}

                  <input
                    type="email" className="auth-input" placeholder="Email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                  />

                  {/* Password row with forgot link */}
                  <div className="auth-password-row">
                    <input
                      type="password" className="auth-input" placeholder="Mot de passe" required
                      value={password} onChange={e => setPassword(e.target.value)}
                    />
                    {!showRegister && (
                      <button
                        type="button"
                        className="auth-forgot-link"
                        onClick={() => setShowForgot(true)}
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>

                  <button type="submit" className="auth-submit-btn">
                    {showRegister ? 'Créer le compte' : 'Se connecter'}
                  </button>
                </form>

                <button
                  className="auth-switch-btn"
                  onClick={() => setShowRegister(!showRegister)}
                  type="button"
                >
                  {showRegister ? 'Déjà un compte ? Se connecter' : 'Créer un compte'}
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}