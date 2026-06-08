import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/pages/header';
import FileExplorer from './components/explorer/FileExplorer';
import CodeEditor from './components/editor/CodeEditor';
import AIChat from './components/chat/AIChat';
import RepoSelector from './components/explorer/RepoSelector';
import PushModal from './components/modals/PushModal';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useRepo } from './hooks/useRepo';
import { useMessages } from './hooks/useMessages';

function App() {
  const { user, authLoading, showRegister, authError, setAuthError, handleLocalAuth, handleLoginGitHub, handleLogout } = useAuth();
  const { repo, branch, branches, files, selectRepo, changeBranch, setBranches, setFiles, setFilesLoading, explorerOpen, setExplorerOpen } = useRepo();
  const { messages, isAILoading, answerCount, openFiles, activeFilePath, messagesRef, setOpenFiles, setActiveFilePath, fileContents, originalContents, modifiedFiles, historyLogs, setFileContents, setOriginalContents, setModifiedFiles, handleSelectFile, handleSelectRepo, handleChangeBranch } = useMessages();

  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardRange, setDashboardRange] = useState('7d');
  const [activeView, setActiveView] = useState('workspace');
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleShowDashboard = useCallback(() => setActiveView('dashboard'), []);
  const handleShowWorkspace = useCallback(() => setActiveView('workspace'), []);

  return (
    <div className="App">
      <Header onShowDashboard={handleShowDashboard} onShowWorkspace={handleShowWorkspace} />
      {activeView === 'workspace' && (
        <div className="workspace">
          <FileExplorer
            files={files}
            onSelectFile={handleSelectFile}
            onSelectRepo={handleSelectRepo}
            onChangeBranch={handleChangeBranch}
            repo={repo}
            branch={branch}
            branches={branches}
            explorerOpen={explorerOpen}
            setExplorerOpen={setExplorerOpen}
          />
          <CodeEditor
            activeFile={fileContents[activeFilePath]}
            onChange={(newContent) => setFileContents((contents) => ({ ...contents, [activeFilePath]: newContent }))}
          />
          <AIChat
            messages={messages}
            loading={isAILoading}
            answerCount={answerCount}
          />
        </div>
      )}
      {activeView === 'dashboard' && <Dashboard stats={dashboardStats} loading={dashboardLoading} range={dashboardRange} />}
      <RepoSelector open={showRepoSelector} onClose={() => setShowRepoSelector(false)} />
      <PushModal open={showPushModal} onClose={() => setShowPushModal(false)} />
    </div>
  );
}

export default App;
