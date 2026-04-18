import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Code, Settings, Folder, File, Upload, Menu, ChevronRight,
  Download, X, GitCommit, Check, Loader, ExternalLink, Tag, Trash2, Edit3
} from 'lucide-react';
import Markdown from '../components/Markdown';
import './Repository.css';

type Tab = 'code' | 'commits' | 'releases' | 'settings';

const LANG_COLORS: Record<string, string> = {
  '.js': '#f1e05a', '.ts': '#3178c6', '.tsx': '#3178c6', '.jsx': '#f1e05a',
  '.py': '#3572A5', '.html': '#e34c26', '.css': '#563d7c', '.scss': '#c6538c',
  '.json': '#29b6f6', '.md': '#41b883', '.go': '#00ADD8',
  '.cpp': '#f34b7d', '.c': '#555555', '.rs': '#dea584',
  '.java': '#b07219', '.rb': '#701516', '.sh': '#89e051',
};

const OPENABLE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.scss', '.json', '.md', '.go', '.cpp', '.c', '.rs', '.java', '.rb', '.sh', '.txt', '.csv', '.xml', '.yaml', '.yml'];

export default function Repository() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('code');
  const [files, setFiles] = useState<any[]>([]);
  const [readme, setReadme] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [langStats, setLangStats] = useState<Record<string, { size: number; files: string[] }>>({});
  const [filteredLang, setFilteredLang] = useState<string | null>(null);

  // File viewer
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string; path: string } | null>(null);

  // Upload animation
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; done: boolean }[]>([]);
  const [uploadDone, setUploadDone] = useState(false);

  // Commits
  const [commits, setCommits] = useState<any[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);

  // Releases
  const [releases, setReleases] = useState<any[]>([]);

  // Rename
  const [newRepoName, setNewRepoName] = useState(name || '');
  const [renameError, setRenameError] = useState('');

  const api = (window as any).api;

  // Load root files
  const loadFiles = async (subPath = '') => {
    if (!api || !name) return;
    const res = await api.getRepoFiles(name, subPath);
    setFiles(res || []);
  };

  // Load README — search recursively so it works regardless of where it is
  const loadReadme = async () => {
    if (!api || !name) return;
    const rm = await api.getReadme(name);
    setReadme(rm);
  };

  const loadLangStats = async () => {
    if (!api || !name) return;
    const stats = await api.getLanguageStats(name);
    setLangStats(stats || {});
  };

  const loadCommits = async () => {
    if (!api || !name) return;
    const c = await api.getCommits(name);
    setCommits(c || []);
  };

  const loadReleases = async () => {
    if (!api || !name) return;
    const r = await api.getReleases(name);
    setReleases(r || []);
  };

  useEffect(() => {
    setCurrentPath('');
    setFilteredLang(null);
    setNewRepoName(name || '');
    loadFiles('');
    loadReadme();
    loadLangStats();
  }, [name]);

  useEffect(() => {
    if (activeTab === 'commits') loadCommits();
    if (activeTab === 'releases') loadReleases();
  }, [activeTab, name]);

  const handleFolderClick = (p: string) => {
    setCurrentPath(p);
    setFilteredLang(null);
    loadFiles(p);
  };

  const handleFileClick = async (filePath: string, fileName: string) => {
    if (!api || !name) return;
    const isTextFile = OPENABLE_EXTS.some(ext => fileName.toLowerCase().endsWith(ext)) || !fileName.includes('.');
    if (!isTextFile) {
      alert(`Cannot open ${fileName}. Only text-based files are supported in the preview UI.`);
      return;
    }
    const content = await api.getFileContent(name, filePath);
    if (content !== null) setViewingFile({ name: fileName, content, path: filePath });
  };

  const handleOpenFile = async (filePath: string) => {
    if (!api || !name) return;
    await api.openFile(name, filePath);
  };

  const handleUpload = async () => {
    if (!api || !name) return;
    const res = await api.uploadFile(name);
    if (res?.ok && res.files?.length > 0) {
      const items: { name: string; done: boolean }[] = res.files.map((f: string) => ({ name: f, done: false }));
      setUploadingFiles(items);
      for (let i = 0; i < items.length; i++) {
        await new Promise(r => setTimeout(r, 100));
        setUploadingFiles(prev => prev.map((p, idx) => idx === i ? { ...p, done: true } : p));
      }
      setUploadDone(true);
      setTimeout(() => {
        setUploadingFiles([]); setUploadDone(false);
        loadFiles(currentPath); loadLangStats(); loadReadme();
      }, 1500);
    } else if (res?.ok) {
      loadFiles(currentPath); loadLangStats(); loadReadme();
    }
  };

  const handleCreateCommit = async () => {
    if (!commitMsg.trim() || !name) return;
    setCommitting(true);
    await api.createCommit(name, commitMsg.trim());
    setCommitMsg('');
    await loadCommits();
    setCommitting(false);
  };

  const handleDeleteRelease = async (filename: string) => {
    if (!api || !name) return;
    if (!window.confirm(`Delete release "${filename}"?`)) return;
    await api.deleteRelease(name, filename);
    loadReleases();
  };

  const handleRename = async () => {
    if (!newRepoName.trim() || newRepoName.trim() === name) return;
    setRenameError('');
    const res = await api.renameRepo(name, newRepoName.trim());
    if (res?.ok) navigate(`/repo/${newRepoName.trim()}`);
    else setRenameError(res?.message || 'Rename failed');
  };

  // Files shown in browser: if filtering by lang, use that lang's files list from stats
  const displayedFiles = filteredLang
    ? (langStats[filteredLang]?.files || []).map((fp: string) => ({
        name: fp.split('/').pop() || fp,
        path: fp,
        isDirectory: false,
        size: 0,
        date: '',
      }))
    : files;

  const totalSize = Object.values(langStats).reduce((a, b) => a + b.size, 0);

  const formatBytes = (b: number) => {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 ** 2).toFixed(2) + ' MB';
  };

  const TABS: { key: Tab; icon: any; label: string }[] = [
    { key: 'code',     icon: Code,      label: 'Code'     },
    { key: 'commits',  icon: GitCommit, label: 'Commits'  },
    { key: 'settings', icon: Settings,  label: 'Settings' },
  ];

  return (
    <div className="repo-page fade-in">
      {/* Header */}
      <div className="repo-header">
        <div className="container">
          <div className="repo-title-row">
            <RepoIcon />
            <Link to="/profile" className="user-link">GitbotUser</Link>
            <span className="separator">/</span>
            <span className="repo-name-text">{name}</span>
            <span className="badge">Public</span>
          </div>
          <div className="repo-tabs">
            {TABS.map(t => (
              <button key={t.key} className={`repo-tab-btn ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container repo-layout">
        {/* File Viewer Modal */}
        {viewingFile && (
          <div className="topbar-modal-overlay fade-in" style={{ zIndex: 1000 }} onClick={() => setViewingFile(null)}>
            <div className="topbar-modal" style={{ width: '80%', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <File size={16} /> {viewingFile.name}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="button" onClick={() => handleOpenFile(viewingFile.path)}>
                    <ExternalLink size={14} /> Open Native
                  </button>
                  <button className="topbar-icon-btn" onClick={() => setViewingFile(null)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <textarea 
                className="input" 
                readOnly 
                value={viewingFile.content} 
                style={{ flex: 1, resize: 'none', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre', padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>
        )}

        <div className="repo-main">

          {/* ── CODE TAB ── */}
          {activeTab === 'code' && (
            <>
              {/* Toolbar */}
              <div className="repo-toolbar">
                <div className="breadcrumb-bar">
                  <button
                    onClick={() => { setCurrentPath(''); setFilteredLang(null); loadFiles(''); }}
                    className="breadcrumb-btn">
                    {name}
                  </button>
                  {!filteredLang && currentPath.split('/').filter(Boolean).map((part, i, arr) => (
                    <span key={i} className="breadcrumb-sep-wrap">
                      <ChevronRight size={13} className="breadcrumb-chevron" />
                      <button className="breadcrumb-btn"
                        onClick={() => handleFolderClick(arr.slice(0, i + 1).join('/'))}>
                        {part}
                      </button>
                    </span>
                  ))}
                  {filteredLang && (
                    <span className="filter-badge">
                      {filteredLang} files
                      <button onClick={() => { setFilteredLang(null); loadFiles(currentPath); }}><X size={12} /></button>
                    </span>
                  )}
                </div>
                <div className="repo-actions">
                  <button className="button" onClick={handleUpload}>
                    <Upload size={14} /> Upload
                  </button>
                  <button className="button button-primary" onClick={() => api?.downloadRepo(name!)}>
                    <Download size={14} /> ZIP
                  </button>
                </div>
              </div>

              {/* Upload animation */}
              {uploadingFiles.length > 0 && (
                <div className="upload-anim-box">
                  <div className="upload-anim-title">
                    {uploadDone ? 'Upload complete!' : 'Uploading files…'}
                  </div>
                  {uploadingFiles.map((f, i) => (
                    <div key={i} className="upload-file-item">
                      {f.done
                        ? <span className="check-icon"><Check size={15} /></span>
                        : <Loader size={15} style={{ color: 'var(--accent-color)', animation: 'spin 0.8s linear infinite' }} />
                      }
                      <span className="upload-file-name">{f.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* File browser */}
              <div className="file-browser">
                <div className="file-header-row">
                  <img src="https://avatars.githubusercontent.com/u/0" width="20" height="20"
                    style={{ borderRadius: '50%' }} alt="user" />
                  <span className="file-header-user">GitbotUser</span>
                  <span className="file-header-msg">
                    {filteredLang ? `Showing ${filteredLang} files` : 'Updated project files'}
                  </span>
                </div>
                {displayedFiles.length === 0 && filteredLang && (
                  <div className="file-empty">No <code>{filteredLang}</code> files in this project.</div>
                )}
                {displayedFiles.length === 0 && !filteredLang && (
                  <div className="file-empty">No files uploaded yet. Click Upload to add your project.</div>
                )}
                {displayedFiles.map(f => (
                  <div key={f.path} className="file-row"
                    onClick={() => f.isDirectory ? handleFolderClick(f.path) : handleFileClick(f.path, f.name)}>
                    <div className="file-info">
                      {f.isDirectory
                        ? <Folder size={17} fill="var(--text-secondary)" color="var(--text-secondary)" />
                        : <File size={17} color="var(--text-secondary)" />}
                      <span className="file-link">{f.name}</span>
                    </div>
                    <div className="file-meta">
                      <span className="file-size">{f.isDirectory ? '' : formatBytes(f.size)}</span>
                      <span className="file-date">{f.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* README — always show if present */}
              {readme && (
                <div className="readme-container">
                  <div className="readme-header-bar">
                    <Menu size={15} /> README.md
                  </div>
                  <div className="readme-content">
                    <Markdown content={readme} repoName={name} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── COMMITS TAB ── */}
          {activeTab === 'commits' && (
            <div className="commits-page fade-in">
              <div className="commits-create">
                <input className="input" style={{ flex: 1 }}
                  placeholder="Commit message (e.g. Add login page)"
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateCommit()} />
                <button className="button button-primary" onClick={handleCreateCommit}
                  disabled={!commitMsg.trim() || committing}>
                  {committing ? <span className="spinner" /> : <GitCommit size={14} />}
                  Commit
                </button>
              </div>
              {commits.length === 0 && (
                <div className="empty-state">No commits yet. Create your first commit above.</div>
              )}
              <div className="commit-list">
                {commits.map(c => (
                  <div key={c.id} className="commit-item" style={{ cursor: 'pointer' }} onClick={() => api?.openCommit(name!, c.id)}>
                    <div className="commit-icon"><GitCommit size={16} /></div>
                    <div className="commit-info">
                      <div className="commit-msg">{c.message} <span style={{fontSize:'12px', color:'var(--text-secondary)', marginLeft:'8px'}}>(Click to view files)</span></div>
                      <div className="commit-meta">
                        <code className="commit-id">{c.id}</code>
                        <span>{new Date(c.date).toLocaleString()}</span>
                        <span>{c.files?.length || 0} files</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* ── SETTINGS TAB ── */}
          {activeTab === 'settings' && (
            <div className="repo-settings-page fade-in">
              <h3>Repository Settings</h3>

              {/* Rename */}
              <div className="settings-box">
                <div className="settings-box-title"><Edit3 size={15} /> Rename Repository</div>
                <div className="settings-box-body">
                  <input className="input" style={{ flex: 1 }}
                    value={newRepoName}
                    onChange={e => setNewRepoName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename()}
                    placeholder="New repository name"
                  />
                  <button className="button button-primary"
                    disabled={!newRepoName.trim() || newRepoName.trim() === name}
                    onClick={handleRename}>
                    Rename
                  </button>
                </div>
                {renameError && <p className="settings-box-error">{renameError}</p>}
                <p className="settings-box-hint">Warning: changing the name will update the URL.</p>
              </div>

              {/* Danger Zone */}
              <div className="danger-zone">
                <div className="danger-zone-title">Danger Zone</div>
                <div className="danger-zone-item">
                  <div>
                    <strong>Delete this repository</strong>
                    <p>This action cannot be undone. All files, commits and releases will be permanently deleted.</p>
                  </div>
                  <button className="button button-danger"
                    onClick={async () => {
                      if (window.confirm(`Delete "${name}" permanently?`)) {
                        await api?.deleteRepo(name!);
                        navigate('/profile');
                      }
                    }}>
                    Delete Repository
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SIDEBAR ── */}
        <div className="repo-sidebar">
          {/* Releases section in sidebar */}
          <div className="sidebar-block">
            <div className="sidebar-block-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Releases</span>
              <button className="button" style={{ fontSize: '11px', padding: '2px 6px' }} onClick={async () => {
                  const ok = await api?.uploadRelease(name!);
                  if (ok) loadReleases();
              }}>
                <Upload size={12} /> Add
              </button>
            </div>
            {releases.length === 0 ? (
              <p className="sidebar-about">No releases published.</p>
            ) : (
              <div className="sidebar-release-list">
                {releases.map((r, i) => (
                  <div key={i} className="sidebar-release-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', overflow: 'hidden' }} onClick={() => api?.openRelease(name!, r.name)}>
                      <Tag size={13} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    </div>
                    <button className="topbar-icon-btn" style={{ flexShrink: 0 }} onClick={() => handleDeleteRelease(r.name)}>
                      <Trash2 size={13} color="var(--red)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Languages */}
          {totalSize > 0 && (
            <div className="sidebar-block">
              <div className="sidebar-block-title">Languages</div>
              <div className="lang-bar-strip">
                {Object.entries(langStats)
                  .sort((a, b) => b[1].size - a[1].size)
                  .map(([ext, d]) => (
                    <div key={ext}
                      title={`${ext}: ${((d.size / totalSize) * 100).toFixed(1)}%`}
                      className="lang-bar-seg"
                      style={{ width: `${(d.size / totalSize) * 100}%`, background: LANG_COLORS[ext] || '#8b949e' }} />
                  ))}
              </div>
              <div className="lang-legend">
                {Object.entries(langStats)
                  .sort((a, b) => b[1].size - a[1].size)
                  .slice(0, 6)
                  .map(([ext, d]) => (
                    <button key={ext}
                      className={`lang-legend-item ${filteredLang === ext ? 'active' : ''}`}
                      onClick={() => {
                        if (filteredLang === ext) {
                          setFilteredLang(null);
                          loadFiles(currentPath);
                        } else {
                          setFilteredLang(ext);
                          setActiveTab('code');
                          setCurrentPath('');
                        }
                      }}>
                      <span className="lang-dot" style={{ background: LANG_COLORS[ext] || '#8b949e' }} />
                      <span className="lang-name">{ext.slice(1)}</span>
                      <span className="lang-pct">{((d.size / totalSize) * 100).toFixed(1)}%</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* About */}
          <div className="sidebar-block">
            <div className="sidebar-block-title">About</div>
            <p className="sidebar-about">No description provided.</p>
          </div>
        </div>
      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="modal-backdrop" onClick={() => setViewingFile(null)}>
          <div className="file-modal" onClick={e => e.stopPropagation()}>
            <div className="file-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <File size={15} />
                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{viewingFile.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="button" style={{ fontSize: '12px' }}
                  onClick={() => handleOpenFile(viewingFile.path)}>
                  <ExternalLink size={13} /> Open externally
                </button>
                <button className="button" style={{ fontSize: '12px' }}
                  onClick={() => navigator.clipboard.writeText(viewingFile.content)}>
                  Copy
                </button>
                <button className="topbar-icon-btn" onClick={() => setViewingFile(null)}><X size={16} /></button>
              </div>
            </div>
            <div className="file-modal-body">
              <Markdown content={`\`\`\`${viewingFile.name.split('.').pop()}\n${viewingFile.content}\n\`\`\``} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RepoIcon() {
  return (
    <svg height="20" viewBox="0 0 16 16" width="20" style={{ fill: 'var(--text-secondary)' }}>
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z" />
    </svg>
  );
}
