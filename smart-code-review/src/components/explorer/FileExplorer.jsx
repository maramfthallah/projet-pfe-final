import { useState, useMemo, useCallback } from 'react';
import { getIconFromPath, getColorFromPath, isBinaryFile } from '../../constants/modes';
import './FileExplorer.css';

/* ─── Build tree structure from flat file list ─── */
function buildTree(files) {
  const root = { name: '', children: {}, type: 'dir' };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: isLast ? file.type : 'dir',
          children: {},
          sha: isLast ? file.sha : null,
          size: isLast ? file.size : 0,
        };
      }

      current = current.children[part];
    }
  }

  return root;
}

/* ─── Tree Node Component ─── */
function TreeNode({ node, depth, expandedDirs, onToggleDir, onSelectFile, activeFilePath, filterQuery }) {
  const isDir = node.type === 'dir';
  const isExpanded = expandedDirs.has(node.path);
  const isActive = activeFilePath === node.path;
  const children = Object.values(node.children);

  // Sort: directories first, then files alphabetically
  const sorted = useMemo(() =>
    [...children].sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    }),
    [children]
  );

  // Filter by query
  const filtered = useMemo(() => {
    if (!filterQuery) return sorted;
    return sorted.filter(child => {
      if (child.type === 'dir') return true; // Always show dirs (they might contain matches)
      return child.path.toLowerCase().includes(filterQuery.toLowerCase());
    });
  }, [sorted, filterQuery]);

  if (isDir) {
    return (
      <li className="fe__node">
        <button
          className={`fe__dir ${isExpanded ? 'fe__dir--open' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onToggleDir(node.path)}
        >
          <span className="material-symbols-rounded fe__chevron">
            {isExpanded ? 'expand_more' : 'chevron_right'}
          </span>
          <span className="material-symbols-rounded fe__folder-icon">
            {isExpanded ? 'folder_open' : 'folder'}
          </span>
          <span className="fe__name">{node.name}</span>
        </button>
        {isExpanded && filtered.length > 0 && (
          <ul className="fe__children">
            {filtered.map(child => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                activeFilePath={activeFilePath}
                filterQuery={filterQuery}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // File node
  const icon = getIconFromPath(node.name);
  const color = getColorFromPath(node.name);
  const binary = isBinaryFile(node.name);

  return (
    <li className="fe__node">
      <button
        className={`fe__file ${isActive ? 'fe__file--active' : ''} ${binary ? 'fe__file--binary' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !binary && onSelectFile(node.path)}
        title={binary ? 'Binary file — cannot edit' : node.path}
      >
        <span className="material-symbols-rounded fe__file-icon" style={{ color }}>
          {icon}
        </span>
        <span className="fe__name">{node.name}</span>
      </button>
    </li>
  );
}


/* ═══════════════════════════════════════════
   FILE EXPLORER — Main Component
═══════════════════════════════════════════ */
export default function FileExplorer({
  files = [],
  loading = false,
  activeFilePath,
  onSelectFile,
  repo,
  branch,
  branches = [],
  onChangeBranch,
  onConnectRepo,
  onOpenLocal,
  projectType,
  onChangeRepo,
  modifiedFiles = new Set(),
}) {
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [filterQuery, setFilterQuery] = useState('');

  const tree = useMemo(() => buildTree(files), [files]);

  const toggleDir = useCallback((path) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allDirs = files.filter(f => f.type === 'dir').map(f => f.path);
    setExpandedDirs(new Set(allDirs));
  }, [files]);

  const collapseAll = useCallback(() => {
    setExpandedDirs(new Set());
  }, []);

  const rootChildren = Object.values(tree.children);
  const sortedRoot = [...rootChildren].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  /* ─── No repo connected ─── */
  if (!repo) {
    return (
      <aside className="fe" id="file-explorer">
        <div className="fe__header">
          <span className="fe__header-title">Explorer</span>
        </div>
        <div className="fe__empty">
          <div className="fe__empty-icon">
            <span className="material-symbols-rounded">folder_off</span>
          </div>
          <p className="fe__empty-title">No Project Linked</p>
          <p className="fe__empty-desc">Connect a GitHub repository or upload a local folder to start editing code with AI assistance.</p>
          <button className="fe__connect-btn" onClick={onConnectRepo} id="connect-repo-btn" style={{ marginBottom: '10px' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Access GitHub Repos
          </button>
          
          <button className="fe__connect-btn" onClick={onOpenLocal} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>folder_open</span>
            Open Local Folder
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fe" id="file-explorer">
      {/* Header */}
      <div className="fe__header">
        <span className="fe__header-title">Explorer</span>
        <div className="fe__header-actions">
          <button className="fe__icon-btn" onClick={expandAll} title="Expand all">
            <span className="material-symbols-rounded">unfold_more</span>
          </button>
          <button className="fe__icon-btn" onClick={collapseAll} title="Collapse all">
            <span className="material-symbols-rounded">unfold_less</span>
          </button>
        </div>
      </div>

      {/* Repo info */}
      <div className="fe__repo-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="fe__repo-name" title={repo.fullName || repo.name} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '16px', opacity: 0.7 }}>
              {projectType === 'local' ? 'folder' : 'book'}
            </span>
            <span>{repo.name}</span>
          </div>
          <button 
            className="fe__icon-btn" 
            onClick={onChangeRepo} 
            title={projectType === 'local' ? "Open different local folder" : "Change GitHub Repository"}
            style={{ marginLeft: '8px' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>swap_horiz</span>
          </button>
        </div>

        {/* Branch selector (GitHub only) */}
        {projectType === 'github' && (
          <div className="fe__branch">
            <span className="material-symbols-rounded">fork_right</span>
            <select
              value={branch}
              onChange={(e) => onChangeBranch(e.target.value)}
              className="fe__branch-select"
              id="branch-selector"
            >
              {branches.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="fe__search">
        <span className="material-symbols-rounded fe__search-icon">search</span>
        <input
          type="text"
          className="fe__search-input"
          placeholder="Filter files..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          id="file-search"
        />
        {filterQuery && (
          <button className="fe__search-clear" onClick={() => setFilterQuery('')}>
            <span className="material-symbols-rounded">close</span>
          </button>
        )}
      </div>

      {/* File Tree */}
      <div className="fe__tree-container">
        {loading ? (
          <div className="fe__loading">
            <div className="fe__spinner" />
            <span>Loading files...</span>
          </div>
        ) : (
          <ul className="fe__tree">
            {sortedRoot.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                expandedDirs={expandedDirs}
                onToggleDir={toggleDir}
                onSelectFile={onSelectFile}
                activeFilePath={activeFilePath}
                filterQuery={filterQuery}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Modified files indicator */}
      {modifiedFiles.size > 0 && (
        <div className="fe__modified-bar">
          <span className="material-symbols-rounded">edit_note</span>
          <span>{modifiedFiles.size} modified file{modifiedFiles.size > 1 ? 's' : ''}</span>
        </div>
      )}
    </aside>
  );
}
