import './Dashboard.css';

import MetricsChart from './MetricsChart';
import AlertBanner from './AlertBanner';
import ActivityFeed from './ActivityFeed';

export default function Dashboard({
  repo,
  branch,
  projectType,
  filesCount,
  openFilesCount,
  modifiedFilesCount,
  historyCount,
  historyLogs = [],
  lastAnalysis,
  dashboardStats,
  dashboardLoading,
  dashboardRange,
  onChangeDashboardRange,
  onRunProjectAnalysis,
  onShowHistory,
  onOpenLocal,
  onConnectGithub,
}) {
  const repoName = repo?.name || 'Aucun projet';
  const projectSource = projectType === 'github' ? 'GitHub' : projectType === 'local' ? 'Local' : 'Aucun';
  const lastAnalysisMode = lastAnalysis?.analysisMode || 'Aucune analyse';
  const lastAnalysisDate = lastAnalysis?.createdAt
    ? new Date(lastAnalysis.createdAt).toLocaleString()
    : 'Aucune date';
  const backendTotalAnalyses = dashboardStats?.totalAnalyses ?? historyCount;
  const backendSeverityCounts = dashboardStats?.severityCounts || {};
  const backendIssueCount = Object.values(backendSeverityCounts).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const findingsSource = dashboardStats?.recentFindings?.length ? 'backend' : 'local';
  const findingsData = dashboardStats?.recentFindings?.length ? dashboardStats.recentFindings : historyLogs.slice(0, 6);
  const recentRangeLabel = dashboardStats?.range
    ? dashboardStats.range === 'all' ? 'Tous' : `${dashboardStats.range.replace('d', '')} jours`
    : '7 jours';
  const isEmptyDashboard = !dashboardLoading && !repo && backendTotalAnalyses === 0 && historyLogs.length === 0;

  function extractJsonCandidate(text) {
    if (!text || typeof text !== 'string') return null;

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;

      if (depth === 0) {
        return text.slice(start, i + 1).trim();
      }
    }

    return null;
  }

  function getFindingMetadata(item) {
    const raw = typeof item.result === 'string' ? item.result : item.result?.rawText || '';
    let fileChanges = [];
    let summary = item.summary || '';

    if (item.result && typeof item.result === 'object' && Array.isArray(item.result.fileChanges)) {
      fileChanges = item.result.fileChanges.map((change) => ({
        path: change.path || item.fileName || 'project',
        severity: change.severity || 'medium',
        summary: change.summary || '',
      }));
    }

    if (fileChanges.length === 0 && Array.isArray(item.fileChanges)) {
      fileChanges = item.fileChanges.map((change) => ({
        path: change.path || item.fileName || 'project',
        severity: change.severity || 'medium',
        summary: change.summary || '',
      }));
    }

    if (fileChanges.length === 0) {
      try {
        const candidate = extractJsonCandidate(raw);
        if (candidate) {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed.fileChanges) && parsed.fileChanges.length > 0) {
            fileChanges = parsed.fileChanges.map((change) => ({
              path: change.path || item.fileName || 'project',
              severity: change.severity || 'medium',
              summary: change.summary || '',
            }));
          }
        }
      } catch (error) {
        fileChanges = [];
      }
    }

    return {
      severity: fileChanges[0]?.severity || null,
      path: fileChanges[0]?.path || item.fileName || 'project',
      summary: fileChanges[0]?.summary || summary,
      fileChanges,
      snippet: raw.slice(0, 220),
      raw,
    };
  }

  // Détection d'un problème critique
  const hasCritical = findingsData.some(f => {
    const meta = getFindingMetadata(f);
    return meta.severity === 'critical';
  });

  // Feed d'activité (exemple simple, à améliorer avec vraies données commits/analyses)
  const activityFeed = findingsData.slice(0, 5).map(f => ({
    date: new Date(f.createdAt).toLocaleDateString(),
    description: f.mode ? `Analyse ${f.mode}` : 'Analyse',
  }));

  return (
    <section className="dashboard">
      {hasCritical && (
        <AlertBanner message="Problème critique détecté dans le projet !" severity="critical" />
      )}
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Résumé du projet</p>
          <h1>Dashboard SmartCodeReview</h1>
          <p className="dashboard__subtitle">Vue d'ensemble rapide du projet, des analyses et des actions disponibles.</p>
        </div>
        <div className="dashboard__actions">
          <button type="button" className="dashboard__btn" onClick={onOpenLocal}>Importer un projet local</button>
          <button type="button" className="dashboard__btn dashboard__btn--secondary" onClick={onConnectGithub}>Connecter GitHub</button>
        </div>
      </header>

      <ActivityFeed activities={activityFeed} />

      <div className="dashboard__grid">
        {dashboardLoading ? (
          <section className="dashboard__card dashboard__card--empty" style={{ gridColumn: 'span 12' }}>
            <h2>Chargement du dashboard</h2>
            <p>Nous récupérons les métriques et findings depuis le backend.</p>
          </section>
        ) : isEmptyDashboard ? (
          <section className="dashboard__card dashboard__card--empty" style={{ gridColumn: 'span 12' }}>
            <h2>Dashboard vide</h2>
            <p>Sélectionne un projet GitHub ou importe un dossier local pour afficher des métriques ici.</p>
          </section>
        ) : (
          <>
            <section className="dashboard__card dashboard__card--metrics" style={{ gridColumn: 'span 12' }}>
              <h2>Activité récente</h2>
              <p className="dashboard__mini-text">{`Période sélectionnée : ${recentRangeLabel}`}</p>
              <MetricsChart
                filesCount={filesCount}
                historyCount={historyCount}
                modifiedFilesCount={modifiedFilesCount}
              />
            </section>

        <section className="dashboard__card dashboard__card--findings">
          <h2>Findings récents</h2>
          {findingsData.length === 0 ? (
            <p>Aucune analyse enregistrée.</p>
          ) : (
            <>
              <p className="dashboard__findings-source">
                Source : {findingsSource === 'backend' ? 'API backend' : 'Historique local'}
              </p>
              <ul className="dashboard__findings-list">
                {findingsData.map((item) => {
                  const finding = getFindingMetadata(item);

                  return (
                    <li key={item._id} className="dashboard__finding">
                      <div className="dashboard__finding-top">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <strong className="dashboard__finding-mode">{item.mode || 'assistant'}</strong>
                          {finding.severity && (
                            <span className={`dashboard__badge dashboard__badge--${finding.severity}`}>
                              {finding.severity}
                            </span>
                          )}
                        </div>
                        <span className="dashboard__finding-date">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="dashboard__finding-body">
                        {finding.fileChanges.length > 0 ? (
                          <ul className="dashboard__finding-files">
                            {finding.fileChanges.slice(0, 3).map((change, index) => (
                              <li key={index} className="dashboard__finding-file-item">
                                <span className={`dashboard__badge dashboard__badge--${change.severity}`}>{change.severity}</span>
                                <span>{change.path}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="dashboard__finding-file">{finding.path}</div>
                        )}
                        <div className="dashboard__finding-snippet">
                          {finding.summary || finding.snippet}{finding.raw.length > 220 ? '…' : ''}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
        <article className="dashboard__card dashboard__card--primary">
          <h2>Projet</h2>
          <p>{repoName}</p>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>{projectSource}</dd>
            </div>
            <div>
              <dt>Branche</dt>
              <dd>{branch || '—'}</dd>
            </div>
            <div>
              <dt>Fichiers détectés</dt>
              <dd>{filesCount}</dd>
            </div>
          </dl>
        </article>

        <article className="dashboard__card">
          <h2>Flux</h2>
          <dl>
            <div>
              <dt>Onglets ouverts</dt>
              <dd>{openFilesCount}</dd>
            </div>
            <div>
              <dt>Fichiers modifiés</dt>
              <dd>{modifiedFilesCount}</dd>
            </div>
            <div>
              <dt>Analyses enregistrées</dt>
              <dd>{historyCount}</dd>
            </div>
          </dl>
        </article>

        <article className="dashboard__card dashboard__card--backend">
          <h2>Statistiques backend</h2>
          <div className="dashboard__filter-group">
            {[
              { key: '7d', label: '7j' },
              { key: '30d', label: '30j' },
              { key: '90d', label: '90j' },
              { key: 'all', label: 'Tous' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`dashboard__filter-btn ${dashboardRange === option.key ? 'dashboard__filter-btn--active' : ''}`}
                onClick={() => onChangeDashboardRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {dashboardLoading ? (
            <div className="dashboard__loading-state">Chargement des métriques...</div>
          ) : (
            <>
              <dl>
                <div>
                  <dt>Analyses totales</dt>
                  <dd>{backendTotalAnalyses}</dd>
                </div>
                <div>
                  <dt>Problèmes signalés</dt>
                  <dd>{backendIssueCount}</dd>
                </div>
                <div>
                  <dt>Dernière analyse</dt>
                  <dd>{dashboardStats?.lastAnalysis?.mode || lastAnalysisMode}</dd>
                </div>
              </dl>
              {backendIssueCount > 0 && (
                <div className="dashboard__severity-list">
                  {Object.entries(backendSeverityCounts).map(([severity, count]) => (
                    <span
                      key={severity}
                      className={`dashboard__badge dashboard__badge--${severity} dashboard__badge--metric`}
                    >
                      {severity}: {count}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </article>

        <article className="dashboard__card dashboard__card--highlight">
          <h2>Dernière analyse</h2>
          <p>{lastAnalysis ? lastAnalysisMode : 'Aucune analyse disponible'}</p>
          <p className="dashboard__analysis-date">{lastAnalysis ? lastAnalysisDate : '—'}</p>
        </article>

        {/* Carte Actions rapides supprimée */}
        </>
      )}
      </div>
    </section>
  );
}
