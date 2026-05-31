import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/pages/header';
import FileExplorer from './components/explorer/FileExplorer';
import CodeEditor from './components/editor/CodeEditor';
import AIChat from './components/chat/AIChat';
import RepoSelector from './components/explorer/RepoSelector';
import PushModal from './components/modals/PushModal';
import './App.css';
import { authAPI, githubAPI, callAI, analysisAPI, normalizeAssistantReply } from './utils/api';
import { getLangFromPath } from './constants/modes';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import LandingPage from './components/pages/LandingPage';
import Dashboard from './components/pages/Dashboard';
import { getAnalysisModeConfig } from './constants/analysisModes';
import { buildProjectContextFiles, shouldUseProjectScope } from './utils/projectContext';
import { createReportPdfBlob } from './utils/pdf';

function normalizeWorkspacePath(filePath) {
  if (typeof filePath !== 'string') return '';

  return filePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '');
}

function buildEditableFiles({ activeFilePath, openFiles, fileContents }) {
  const orderedPaths = [
    activeFilePath,
    ...openFiles.filter((path) => path !== activeFilePath),
  ].filter(Boolean);

  return orderedPaths
    .filter((path, index) => orderedPaths.indexOf(path) === index)
    .filter((path) => typeof fileContents[path] === 'string')
    .slice(0, 6)
    .map((path) => ({
      path,
      content: fileContents[path],
      language: getLangFromPath(path),
    }));
}

function formatHistoryMode(mode) {
  const modeConfig = getAnalysisModeConfig(mode);
  if (modeConfig) return modeConfig.label;
  return mode === 'assistant' ? 'AI Assistant' : 'Analysis';
}

function slugifySegment(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function buildReportAsset(message, repoName) {
  if (!message || !message.content?.trim()) return null;

  if (message.analysisMode !== 'report') return null;

  const safeRepoName = repoName || 'project';

  return {
    kind: 'pdf',
    title: `${safeRepoName} Project Report`,
    subtitle: `Generated on ${new Date().toLocaleString()} from ${safeRepoName}`,
    fileName: `${slugifySegment(safeRepoName, 'project')}-${slugifySegment(message.analysisMode || 'report', 'report')}.pdf`,
    ctaLabel: 'Download PDF',
    readyLabel: 'Your file is ready',
    description: 'A polished project report has been generated and is ready to download as a PDF.',
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [projectType, setProjectType] = useState('none');
  const [repo, setRepo] = useState(null);
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState([]);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [openFiles, setOpenFiles] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState('');
  const [fileContents, setFileContents] = useState({});
  const [originalContents, setOriginalContents] = useState({});
  const [modifiedFiles, setModifiedFiles] = useState(new Set());

  const [messages, setMessages] = useState([]);
  const [isAILoading, setIsAILoading] = useState(false);
  const [answerCount, setAnswerCount] = useState(1);

  const [explorerOpen, setExplorerOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardRange, setDashboardRange] = useState('7d');
  const [activeView, setActiveView] = useState('workspace');

  const messagesRef = useRef([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const lastAnalysisMessage = messages
    .slice()
    .reverse()
    .find((message) => message.role === 'assistant' && typeof message.analysisMode === 'string');

  const handleShowDashboard = useCallback(() => setActiveView('dashboard'), []);
  const handleShowWorkspace = useCallback(() => setActiveView('workspace'), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      localStorage.setItem('scr_token', token);
      window.history.replaceState({}, '', '/');
    }

    if (error) {
      setAuthError(`GitHub Auth Error: ${error}`);
      window.history.replaceState({}, '', '/');
    }

    const savedToken = localStorage.getItem('scr_token');
    if (!savedToken) {
      setAuthLoading(false);
      return;
    }

    authAPI.getProfile()
      .then((res) => {
        if (res.data?.success) {
          localStorage.setItem('scr_user', JSON.stringify(res.data.user));
          setUser(res.data.user);
        }
      })
      .catch(() => {
        localStorage.removeItem('scr_token');
        localStorage.removeItem('scr_user');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLoginGitHub = useCallback(() => {
    window.location.href = authAPI.getGitHubAuthUrl();
  }, []);

  const handleLoginGoogle = useCallback(() => {
    window.location.href = authAPI.getGoogleAuthUrl();
  }, []);

  const handleConnectGithub = useCallback(() => {
    if (!user || user.authType === 'local' || user.authType === 'google') {
      handleLoginGitHub();
      return;
    }

    setShowRepoSelector(true);
  }, [handleLoginGitHub, user]);

  const handleLocalAuth = async (event) => {
    event.preventDefault();
    setAuthError('');

    try {
      const response = showRegister
        ? await authAPI.register({ email, password, firstName, lastName })
        : await authAPI.login({ email, password });

      if (response.data?.success) {
        localStorage.setItem('scr_token', response.data.token);
        localStorage.setItem('scr_user', JSON.stringify(response.data.user));
        setUser(response.data.user);
      }
    } catch (error) {
      setAuthError(error.response?.data?.message || error.message);
    }
  };

  const resetWorkspace = useCallback(() => {
    setProjectType('none');
    setRepo(null);
    setBranch('main');
    setBranches([]);
    setFiles([]);
    setOpenFiles([]);
    setActiveFilePath('');
    setFileContents({});
    setOriginalContents({});
    setModifiedFiles(new Set());
    setMessages([]);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('scr_token');
    localStorage.removeItem('scr_user');
    setUser(null);
    resetWorkspace();
  }, [resetWorkspace]);

  const handleSelectRepo = useCallback(async (selectedRepo) => {
    setProjectType('github');
    setRepo(selectedRepo);
    setBranch(selectedRepo.defaultBranch || 'main');
    setOpenFiles([]);
    setActiveFilePath('');
    setFileContents({});
    setOriginalContents({});
    setModifiedFiles(new Set());
    setMessages([]);
    setFilesLoading(true);

    try {
      const [branchRes, treeRes] = await Promise.all([
        githubAPI.getBranches(selectedRepo.owner.login, selectedRepo.name),
        githubAPI.getTree(
          selectedRepo.owner.login,
          selectedRepo.name,
          selectedRepo.defaultBranch || 'main',
        ),
      ]);

      if (branchRes.data?.success) setBranches(branchRes.data.branches);
      if (treeRes.data?.success) setFiles(treeRes.data.files);
    } catch (error) {
      console.error('Failed to load repo:', error);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const handleChangeBranch = useCallback(async (newBranch) => {
    if (projectType !== 'github' || !repo) return;

    setBranch(newBranch);
    setFilesLoading(true);
    setOpenFiles([]);
    setActiveFilePath('');
    setFileContents({});
    setOriginalContents({});
    setModifiedFiles(new Set());
    setMessages([]);

    try {
      const treeRes = await githubAPI.getTree(repo.owner.login, repo.name, newBranch);
      if (treeRes.data?.success) setFiles(treeRes.data.files);
    } catch (error) {
      console.error('Failed to load branch:', error);
    } finally {
      setFilesLoading(false);
    }
  }, [projectType, repo]);

  const handleLocalFolderSelect = async (event) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setFilesLoading(true);
    setProjectType('local');
    setRepo({ name: 'Local Project', owner: { login: 'local' } });
    setBranch('local');
    setBranches([]);
    setOpenFiles([]);
    setActiveFilePath('');
    setModifiedFiles(new Set());
    setMessages([]);

    const nextFiles = [];
    const nextContents = {};

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];

      if (
        file.webkitRelativePath.includes('/node_modules/')
        || file.webkitRelativePath.includes('/.git/')
      ) {
        continue;
      }

      const path = file.webkitRelativePath.split('/').slice(1).join('/');
      nextFiles.push({
        path,
        type: 'file',
        size: file.size,
      });

      const text = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => resolve(loadEvent.target.result);
        reader.readAsText(file);
      });

      nextContents[path] = text;
    }

    setFiles(nextFiles);
    setFileContents(nextContents);
    setOriginalContents(nextContents);
    setFilesLoading(false);
    setShowRepoSelector(false);
  };

  const loadGitHubFileContent = useCallback(async (filePath) => {
    if (projectType !== 'github' || !repo) {
      return typeof fileContents[filePath] === 'string' ? fileContents[filePath] : '';
    }

    if (typeof originalContents[filePath] === 'string') {
      return originalContents[filePath];
    }

    const response = await githubAPI.getFileContent(repo.owner.login, repo.name, filePath, branch);
    if (!response.data?.success) {
      throw new Error(`Failed to load ${filePath}`);
    }

    const content = response.data.file.content || '';
    setFileContents((prev) => (
      typeof prev[filePath] === 'string' ? prev : { ...prev, [filePath]: content }
    ));
    setOriginalContents((prev) => (
      typeof prev[filePath] === 'string' ? prev : { ...prev, [filePath]: content }
    ));

    return content;
  }, [branch, fileContents, originalContents, projectType, repo]);

  const handleSelectFile = useCallback(async (filePath) => {
    if (openFiles.includes(filePath)) {
      setActiveFilePath(filePath);
      return;
    }

    if (projectType === 'github' && typeof fileContents[filePath] !== 'string') {
      try {
        await loadGitHubFileContent(filePath);
      } catch (error) {
        console.error('Failed to load file:', error);
        return;
      }
    }

    setOpenFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    setActiveFilePath(filePath);
  }, [fileContents, loadGitHubFileContent, openFiles, projectType]);

  const handleCloseTab = useCallback((filePath) => {
    setOpenFiles((prev) => {
      const next = prev.filter((path) => path !== filePath);
      if (activeFilePath === filePath) {
        setActiveFilePath(next[next.length - 1] || '');
      }
      return next;
    });
  }, [activeFilePath]);

  const handleFileChange = useCallback((filePath, newContent) => {
    setFileContents((prev) => ({ ...prev, [filePath]: newContent }));
    setModifiedFiles((prev) => {
      const next = new Set(prev);
      if (newContent !== originalContents[filePath]) next.add(filePath);
      else next.delete(filePath);
      return next;
    });
  }, [originalContents]);

  const handleSendMessage = useCallback(async (text, options = {}) => {
    const messageMode = options.analysisMode || 'assistant';
    const userMsg = { id: Date.now(), role: 'user', content: text };
    const loadingId = Date.now() + 1;
    const loadingMsg = {
      id: loadingId,
      role: 'assistant',
      content: '',
      loading: true,
      analysisMode: messageMode,
      analysisScope: options.analysisScope === 'project' ? 'project' : 'file',
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsAILoading(true);

    try {
      const fileContext = activeFilePath ? {
        path: activeFilePath,
        content: fileContents[activeFilePath] || '',
        language: getLangFromPath(activeFilePath),
      } : null;

      const editableFiles = buildEditableFiles({
        activeFilePath,
        openFiles,
        fileContents,
      });
      const analysisScope = shouldUseProjectScope(text, {
        activeFilePath,
        projectMode: options.analysisScope === 'project',
      }) ? 'project' : 'file';
      const projectStructure = files.filter((file) => file.type === 'file').slice(0, 400);
      const projectContextFiles = analysisScope === 'project'
        ? await buildProjectContextFiles({
            files,
            fileContents,
            activeFilePath,
            openFiles,
            excludedPaths: editableFiles.map((file) => file.path),
            loadFileContent: loadGitHubFileContent,
          })
        : [];
      const history = messagesRef.current
        .filter((message) => !message.loading)
        .map((message) => ({ role: message.role, content: message.content }));

      const aiResponse = await callAI(
        text,
        fileContext,
        editableFiles,
        projectStructure,
        projectContextFiles,
        history,
        {
          analysisMode: messageMode,
          analysisScope,
          answerCount,
        },
      );
      const responseCandidates = aiResponse.candidates.length > 0
        ? aiResponse.candidates
        : [{
            index: 0,
            reply: aiResponse.reply,
            fileChanges: aiResponse.fileChanges,
            needsMoreContext: aiResponse.needsMoreContext,
          }];
      const reportAsset = buildReportAsset({
        analysisMode: messageMode,
        analysisScope,
        content: aiResponse.reply,
      }, repo?.name || 'project');

      setMessages((prev) => prev.map((message) => (
        message.id === loadingId
          ? {
              ...message,
              content: aiResponse.reply,
              fileChanges: aiResponse.fileChanges,
              needsMoreContext: aiResponse.needsMoreContext,
              responseCandidates,
              selectedCandidateIndex: aiResponse.selectedCandidateIndex || 0,
              appliedFilePaths: [],
              reportAsset,
              loading: false,
            }
          : message
      )));
    } catch (error) {
      console.error('[AI Chat] Error:', error);
      setMessages((prev) => prev.map((message) => (
        message.id === loadingId
          ? { ...message, content: `Error: ${error.message}`, loading: false }
          : message
      )));
    } finally {
      setIsAILoading(false);
    }
  }, [activeFilePath, answerCount, fileContents, files, loadGitHubFileContent, openFiles, repo]);

  const handleSelectCandidate = useCallback((messageId, candidateIndex) => {
    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) return message;

      const candidate = (message.responseCandidates || []).find(
        (item) => item.index === candidateIndex,
      );
      if (!candidate) return message;

      const nextMessage = {
        ...message,
        content: candidate.reply,
        fileChanges: candidate.fileChanges || [],
        needsMoreContext: Boolean(candidate.needsMoreContext),
        selectedCandidateIndex: candidateIndex,
        appliedFilePaths: [],
      };

      return {
        ...nextMessage,
        reportAsset: buildReportAsset(nextMessage, repo?.name || 'project'),
      };
    }));
  }, [repo]);

  const handleRunProjectAnalysis = useCallback((mode) => {
    const modeConfig = getAnalysisModeConfig(mode);
    if (!modeConfig || files.length === 0) return;

    handleSendMessage(modeConfig.prompt, {
      analysisMode: mode,
      analysisScope: 'project',
    });
  }, [files.length, handleSendMessage]);

  const handleApplyChange = useCallback(async (messageId, fileChange) => {
    const filePath = normalizeWorkspacePath(fileChange?.path);
    const newContent = typeof fileChange?.content === 'string' ? fileChange.content : null;

    if (!filePath || newContent === null) {
      throw new Error('The assistant response did not include a valid file change.');
    }

    const fileExists = files.some((file) => file.type === 'file' && file.path === filePath);
    let originalContent = typeof originalContents[filePath] === 'string'
      ? originalContents[filePath]
      : '';

    if (fileExists && projectType === 'github' && typeof originalContents[filePath] !== 'string') {
      originalContent = await loadGitHubFileContent(filePath);
    }

    if (!fileExists) {
      setFiles((prev) => [
        ...prev,
        { path: filePath, type: 'file', size: newContent.length },
      ]);
      setOriginalContents((prev) => (
        typeof prev[filePath] === 'string' ? prev : { ...prev, [filePath]: '' }
      ));
      originalContent = '';
    }

    setOpenFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    setActiveFilePath(filePath);
    setFileContents((prev) => ({ ...prev, [filePath]: newContent }));
    setModifiedFiles((prev) => {
      const next = new Set(prev);
      if (newContent !== originalContent) next.add(filePath);
      else next.delete(filePath);
      return next;
    });
    setMessages((prev) => prev.map((message) => {
      if (message.id !== messageId) return message;

      const appliedFilePaths = new Set(message.appliedFilePaths || []);
      appliedFilePaths.add(filePath);

      return {
        ...message,
        appliedFilePaths: Array.from(appliedFilePaths),
      };
    }));

    return true;
  }, [files, loadGitHubFileContent, originalContents, projectType]);

  const handlePush = useCallback(async (commitMessage) => {
    if (projectType !== 'github' || !repo || modifiedFiles.size === 0) return;

    setIsPushing(true);

    try {
      const filesToPush = Array.from(modifiedFiles).map((path) => ({
        path,
        content: fileContents[path],
      }));

      const response = await githubAPI.push(repo.owner.login, repo.name, {
        branch,
        message: commitMessage,
        files: filesToPush,
      });

      if (response.data?.success) {
        const nextOriginals = { ...originalContents };
        for (const path of modifiedFiles) {
          nextOriginals[path] = fileContents[path];
        }

        setOriginalContents(nextOriginals);
        setModifiedFiles(new Set());
        setShowPushModal(false);
        setMessages((prev) => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: `Successfully pushed ${filesToPush.length} file(s) to **${branch}**.\n\n[View commit](${response.data.commitUrl})`,
        }]);
      }
    } catch (error) {
      console.error('Push failed:', error);
      setMessages((prev) => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `Push failed: ${error.response?.data?.message || error.message}`,
      }]);
    } finally {
      setIsPushing(false);
    }
  }, [branch, fileContents, modifiedFiles, originalContents, projectType, repo]);

  const handleDownloadZip = useCallback(async () => {
    if (modifiedFiles.size === 0) return;

    const zip = new JSZip();
    for (const path of modifiedFiles) {
      zip.file(path, fileContents[path]);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'smart-code-review-changes.zip');

    const nextOriginals = { ...originalContents };
    for (const path of modifiedFiles) {
      nextOriginals[path] = fileContents[path];
    }

    setOriginalContents(nextOriginals);
    setModifiedFiles(new Set());
    setMessages((prev) => [...prev, {
      id: Date.now(),
      role: 'assistant',
      content: `Successfully downloaded ZIP with ${modifiedFiles.size} modified file(s).`,
    }]);
  }, [fileContents, modifiedFiles, originalContents]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await analysisAPI.getAll();
      if (response.data?.success) {
        setHistoryLogs(response.data.analyses);
      }
    } catch (error) {
      console.error('Failed to load history', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadDashboardStats = useCallback(async (range = dashboardRange) => {
    setDashboardLoading(true);
    try {
      const response = await analysisAPI.getDashboard({ range });
      if (response.data?.success) {
        setDashboardStats(response.data.dashboard);
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics', error);
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboardRange]);

  const handleDashboardRangeChange = useCallback((range) => {
    setDashboardRange(range);
  }, []);

  useEffect(() => {
    if (activeView === 'dashboard') {
      loadDashboardStats(dashboardRange);
    }
  }, [activeView, dashboardRange, loadDashboardStats]);

  const handleLoadHistoryItem = (item) => {
    const analysisScope = item.fileName ? 'file' : 'project';
    const cleanResult = normalizeAssistantReply(item.result?.rawText || '');
    const reportAsset = buildReportAsset({
      analysisMode: item.mode || 'assistant',
      analysisScope,
      content: cleanResult,
    }, repo?.name || 'project');
    const promptMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: item.code || 'Load history...',
    };
    const responseMsg = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      content: cleanResult || 'No text found.',
      fileChanges: [],
      appliedFilePaths: [],
      analysisMode: item.mode || 'assistant',
      analysisScope,
      reportAsset,
    };

    setMessages([promptMsg, responseMsg]);
    setShowHistory(false);
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border-primary)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage
        user={user}
        showRegister={showRegister}
        setShowRegister={setShowRegister}
        authError={authError}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        firstName={firstName}
        setFirstName={setFirstName}
        lastName={lastName}
        setLastName={setLastName}
        onLoginGitHub={handleLoginGitHub}
        onLoginGoogle={handleLoginGoogle}
        onLocalAuth={handleLocalAuth}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLocalFolderSelect}
        style={{ display: 'none' }}
        webkitdirectory="true"
        directory="true"
        multiple
      />

      <Header
        user={user}
        onLoginGitHub={handleLoginGitHub}
        onLogout={handleLogout}
        onToggleExplorer={() => setExplorerOpen((value) => !value)}
        onToggleChat={() => setChatOpen((value) => !value)}
        onShowDashboard={activeView === 'dashboard' ? handleShowWorkspace : handleShowDashboard}
        isDashboardActive={activeView === 'dashboard'}
        explorerOpen={explorerOpen}
        chatOpen={chatOpen}
        repo={repo}
      />

      <div style={{ display: 'flex', flex: 1, marginTop: 'var(--header-h)', overflow: 'hidden' }}>
        {explorerOpen && (
          <FileExplorer
            files={files}
            loading={filesLoading}
            activeFilePath={activeFilePath}
            onSelectFile={handleSelectFile}
            repo={repo}
            branch={branch}
            branches={projectType === 'local' ? [] : branches}
            onChangeBranch={projectType === 'local' ? null : handleChangeBranch}
            onConnectRepo={
              user.authType === 'local' || user.authType === 'google'
                ? handleLoginGitHub
                : () => setShowRepoSelector(true)
            }
            onOpenLocal={() => fileInputRef.current?.click()}
            onChangeRepo={() => {
              if (projectType === 'github') setShowRepoSelector(true);
              else fileInputRef.current?.click();
            }}
            modifiedFiles={modifiedFiles}
            projectType={projectType}
          />
        )}

        {activeView === 'dashboard' ? (
          <Dashboard
            repo={repo}
            branch={branch}
            projectType={projectType}
            filesCount={files.length}
            openFilesCount={openFiles.length}
            modifiedFilesCount={modifiedFiles.size}
            historyCount={historyLogs.length}
            historyLogs={historyLogs}
            lastAnalysis={lastAnalysisMessage}
            dashboardStats={dashboardStats}
            dashboardLoading={dashboardLoading}
            dashboardRange={dashboardRange}
            onChangeDashboardRange={handleDashboardRangeChange}
            onRunProjectAnalysis={handleRunProjectAnalysis}
            onShowHistory={() => {
              setShowHistory(true);
              loadHistory();
            }}
            onOpenLocal={() => fileInputRef.current?.click()}
            onConnectGithub={handleConnectGithub}
          />
        ) : (
          <CodeEditor
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onSelectTab={setActiveFilePath}
            onCloseTab={handleCloseTab}
            fileContents={fileContents}
            onFileChange={handleFileChange}
            modifiedFiles={modifiedFiles}
          />
        )}

        {chatOpen && (
          <AIChat
            messages={messages}
            isLoading={isAILoading}
            onSendMessage={handleSendMessage}
            onRunProjectAnalysis={handleRunProjectAnalysis}
            hasProject={files.length > 0}
            onApplyChange={handleApplyChange}
            activeFilePath={activeFilePath}
            modifiedFilesCount={modifiedFiles.size}
            onPushClick={projectType === 'github' ? () => setShowPushModal(true) : handleDownloadZip}
            projectType={projectType}
            onShowHistory={() => {
              setShowHistory(true);
              loadHistory();
            }}
            onNewChat={() => setMessages([])}
            answerCount={answerCount}
            onAnswerCountChange={setAnswerCount}
            onSelectCandidate={handleSelectCandidate}
            onDownloadPdf={(message) => {
              const reportAsset = message.reportAsset || buildReportAsset(message, repo?.name || 'project');
              if (!reportAsset) return;

              const blob = createReportPdfBlob({
                title: reportAsset.title,
                subtitle: reportAsset.subtitle,
                content: message.content,
              });

              saveAs(blob, reportAsset.fileName);
            }}
          />
        )}
      </div>

      {showRepoSelector && (
        <RepoSelector
          onSelect={handleSelectRepo}
          onClose={() => setShowRepoSelector(false)}
        />
      )}

      {showPushModal && projectType === 'github' && (
        <PushModal
          modifiedFiles={Array.from(modifiedFiles)}
          fileContents={fileContents}
          originalContents={originalContents}
          repo={repo}
          branch={branch}
          onPush={handlePush}
          onClose={() => setShowPushModal(false)}
          isPushing={isPushing}
        />
      )}

      {showHistory && (
        <div className="history-modal__overlay" role="presentation" onMouseDown={() => setShowHistory(false)}>
          <section
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="history-modal__header">
              <div className="history-modal__title-group">
                <span className="history-modal__header-icon material-symbols-rounded">history</span>
                <div>
                  <h2 id="history-title">Conversation History</h2>
                  <p>{historyLogs.length} saved {historyLogs.length === 1 ? 'conversation' : 'conversations'}</p>
                </div>
              </div>
              <button
                type="button"
                className="history-modal__close"
                onClick={() => setShowHistory(false)}
                aria-label="Close history"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="history-modal__content">
              {historyLoading ? (
                <div className="history-modal__state">
                  <span className="history-modal__spinner" aria-hidden="true" />
                  <p>Loading history...</p>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="history-modal__state history-modal__state--empty">
                  <span className="material-symbols-rounded">forum</span>
                  <p>No past conversations found.</p>
                </div>
              ) : (
                <div className="history-list">
                  {historyLogs.map((log) => (
                    <button
                      type="button"
                      key={log._id}
                      className="history-list__item"
                      onClick={() => handleLoadHistoryItem(log)}
                    >
                      <span className="history-list__icon material-symbols-rounded">article</span>
                      <span className="history-list__body">
                        <span className="history-list__topline">
                          <span className="history-list__mode">{formatHistoryMode(log.mode)}</span>
                          <span className="history-list__date">
                            <span className="material-symbols-rounded">schedule</span>
                          {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </span>
                        <span className="history-list__snippet">{log.code || 'Code Snippet'}</span>
                        {log.fileName && (
                          <span className="history-list__file">
                            <span className="material-symbols-rounded">description</span>
                            {log.fileName}
                          </span>
                        )}
                      </span>
                      <span className="history-list__chevron material-symbols-rounded">chevron_right</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
