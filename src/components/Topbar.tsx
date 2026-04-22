import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Plus, ChevronDown, BookMarked, X, Minus, Square, Check, Loader } from 'lucide-react';
import gitbotLogo from '../assets/gitbot.png';
import { useAI } from '../context/AIContext';
import './Topbar.css';

export default function Topbar() {
  const { isStreaming } = useAI();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; done: boolean }[]>([]);
  const [uploadDone, setUploadDone] = useState(false);
  const [avatar, setAvatar] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Load avatar from settings
  useEffect(() => {
    window.api?.getSettings().then((s: any) => {
      if (s?.profileImage) setAvatar(s.profileImage);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Listen for open-new-repo event
  useEffect(() => {
    const handleOpen = () => setModalOpen(true);
    window.addEventListener('open-new-repo', handleOpen);
    return () => window.removeEventListener('open-new-repo', handleOpen);
  }, []);

  const handleCreate = async () => {
    if (!repoName.trim()) return;
    setCreating(true);
    const ok = await window.api?.createRepo(repoName.trim());
    if (ok) {
      const name = repoName.trim();
      setRepoName('');
      setModalOpen(false);
      setCreating(false);
      setUploadProgress([]);
      setUploadDone(false);
      navigate(`/repo/${name}`);
    } else {
      alert('Repository already exists.');
      setCreating(false);
    }
  };

  const handleCreateWithUpload = async () => {
    if (!repoName.trim()) return;
    setCreating(true);
    const ok = await window.api?.createRepo(repoName.trim());
    if (!ok) { alert('Repository already exists.'); setCreating(false); return; }
    const name = repoName.trim();

    // Upload files
    const res = await (window as any).api.uploadFile(name);
    if (res?.ok && res.files?.length > 0) {
      const items = res.files.map((f: string) => ({ name: f, done: false }));
      setUploadProgress(items);
      // Animate file completions
      for (let i = 0; i < items.length; i++) {
        await new Promise(r => setTimeout(r, 120));
        setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, done: true } : p));
      }
    }
    setUploadDone(true);
    setTimeout(() => {
      setModalOpen(false);
      setCreating(false);
      setUploadProgress([]);
      setUploadDone(false);
      setRepoName('');
      navigate(`/repo/${name}`);
    }, 1200);
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/profile" className="topbar-logo">
            <img src={gitbotLogo} alt="GitFusion X" />
          </Link>

          <nav className="topbar-nav">
            <Link to="/profile" className={isActive('/profile') ? 'active' : ''}>GITFUSION X</Link>
            <Link to="/ai" className={isActive('/ai') ? 'active' : ''}>Git X AI</Link>
            <Link to="/image-generator" className={isActive('/image-generator') ? 'active' : ''}>Image Generator</Link>
            <Link to="/profile?tab=repos" className={isActive('/profile?tab=repos') ? 'active' : ''}>Repositories</Link>
            <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>Settings</Link>
            <Link to="/templates" className={isActive('/templates') ? 'active' : ''}>Templates</Link>
            <Link to="/pages" className={isActive('/pages') ? 'active' : ''}>Pages</Link>
            <Link to="/review" className={isActive('/review') ? 'active' : ''}>Review Editor</Link>
            <Link to="/draw" className={isActive('/draw') ? 'active' : ''}>Draw</Link>
          </nav>
        </div>

        {/* Invisible drag region — lets user drag the window */}
        <div className="topbar-drag" />

        <div className="topbar-actions">
          {/* AI streaming indicator near Bell */}
          <button className="topbar-icon-btn" title={isStreaming ? 'AI is generating…' : 'Notifications'} style={{ position: 'relative' }}>
            <Bell size={17} />
            {isStreaming && (
              <span className="topbar-ai-dot" title="AI generating…" />
            )}
          </button>

          <div style={{ position: 'relative' }} ref={dropRef}>
            <button className="topbar-icon-btn topbar-plus-btn" title="Create new"
              onClick={() => setDropdownOpen(v => !v)}>
              <Plus size={17} />
              <ChevronDown size={12} />
            </button>
            {dropdownOpen && (
              <div className="topbar-dropdown">
                <div className="topbar-dropdown-item"
                  onClick={() => { setDropdownOpen(false); setModalOpen(true); }}>
                  <BookMarked size={15} /> New repository
                </div>
              </div>
            )}
          </div>

          <Link to="/settings" style={{ display: 'flex' }}>
            <img className="topbar-avatar"
              src={avatar || gitbotLogo}
              alt="profile"
              onError={e => { (e.target as HTMLImageElement).src = gitbotLogo; }} />
          </Link>

          <div className="win-controls">
            <button className="win-btn" onClick={() => window.api?.winMinimize()} title="Minimize">
              <Minus size={13} />
            </button>
            <button className="win-btn" onClick={() => window.api?.winMaximize()} title="Maximize">
              <Square size={11} />
            </button>
            <button className="win-btn win-close" onClick={() => window.api?.winClose()} title="Close">
              <X size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Create Repository Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookMarked size={17} /> Create a new repository
              </span>
              <button className="topbar-icon-btn" onClick={() => setModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <div className="modal-body">
              {!uploadDone ? (
                <>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                    Repository name
                  </label>
                  <input className="input" style={{ width: '100%' }}
                    placeholder="my-project" autoFocus
                    value={repoName}
                    onChange={e => setRepoName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Stored at <code style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '4px' }}>~/.gitbot/repos/{repoName || 'name'}</code>
                  </p>

                  {/* Upload progress animation */}
                  {uploadProgress.length > 0 && (
                    <div className="upload-progress-list">
                      {uploadProgress.map((f, i) => (
                        <div key={i} className="upload-file-item">
                          {f.done
                            ? <span className="check-icon"><Check size={15} /></span>
                            : <Loader size={15} className="spinner-icon" style={{ color: 'var(--accent-color)', animation: 'spin 0.8s linear infinite' }} />
                          }
                          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{f.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ color: 'var(--green)', fontSize: '40px', marginBottom: '12px' }}>
                    <Check size={48} strokeWidth={2} />
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '16px' }}>Repository created successfully!</p>
                </div>
              )}
            </div>

            {!uploadDone && !creating && (
              <div className="modal-footer">
                <button className="button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="button" onClick={handleCreateWithUpload} disabled={!repoName.trim()}>
                  Create &amp; Upload Files
                </button>
                <button className="button button-primary" onClick={handleCreate}
                  disabled={!repoName.trim()}>
                  Create repository
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
