import { useState, useEffect } from 'react';
import { User, Palette, Save, CheckCircle, Upload, Info, Cpu, HardDrive, ExternalLink, Plus, X, Presentation, Download, CheckSquare, Loader, FileCode } from 'lucide-react';
import gitbotLogo from '../assets/gitbot.png';
import './Settings.css';
import './Templates.css';

const THEMES = [
  { value: 'dark', label: 'Dark', desc: 'GitHub dark default', bg: '#0d1117', accent: '#2f81f7' },
  { value: 'light', label: 'Light', desc: 'Clean light theme', bg: '#ffffff', accent: '#0969da' },
  { value: 'github', label: 'GitHub Deep', desc: 'Deep dark extra vibrant', bg: '#010409', accent: '#2f81f7' },
  { value: 'modern-dark', label: 'Dark #181818', desc: 'Pure flat dark minimal', bg: '#181818', accent: '#60a5fa' },
  { value: 'modern-glass', label: 'Glass', desc: 'Frosted glassmorphism', bg: '#0f1420', accent: '#818cf8' },
  { value: 'modern-aurora', label: 'Aurora', desc: 'Animated space pulse', bg: '#08081a', accent: '#7c6ae8' },
  { value: 'modern-midnight', label: 'Midnight', desc: 'Animated warm gold', bg: '#06070f', accent: '#f5a623' },
  { value: 'modern-crimson', label: 'Crimson', desc: 'Animated emerald red', bg: '#0a0608', accent: '#e53e5b' },
  { value: 'modern-neon', label: 'Neon', desc: 'Animated cyan & pink', bg: '#050505', accent: '#00ffff' },
  { value: 'modern-synthwave', label: 'Synth', desc: 'Animated 80s purple', bg: '#090314', accent: '#ff8c00' },
  { value: 'modern-ocean', label: 'Ocean', desc: 'Animated deep blue', bg: '#020b14', accent: '#38bdf8' },
  { value: 'modern-forest', label: 'Forest', desc: 'Deep green nature', bg: '#071010', accent: '#34d399' },
  { value: 'modern-copper', label: 'Copper', desc: 'Warm bronze dark', bg: '#100b06', accent: '#cd7f32' },
  { value: 'modern-rose', label: 'Rose', desc: 'Soft pink mauve dark', bg: '#120a0e', accent: '#f472b6' },
  { value: 'modern-amber', label: 'Amber Gold', desc: 'Animated deep amber', bg: '#080604', accent: '#ffbf00' },
  { value: 'modern-obsidian-gold', label: 'Obsidian', desc: 'Animated sharp gold', bg: '#040404', accent: '#ffd700' },
  { value: 'modern-sunset', label: 'Sunset', desc: 'Animated golden orange', bg: '#0f0505', accent: '#ff9933' },
  { value: 'modern-desert', label: 'Desert', desc: 'Animated sand & gold', bg: '#0a0805', accent: '#e6b800' },
];

const DEFAULT_TEMPLATES = [
  { label: 'Code Review', prompt: 'Review this code and suggest improvements for readability, performance, and best practices:' },
  { label: 'Explain Code', prompt: 'Explain this code step by step for a junior developer:' },
  { label: 'Write Tests', prompt: 'Write comprehensive unit tests for this code:' },
  { label: 'Fix Bug', prompt: 'Find and fix the bug in this code, then explain what was wrong:' },
  { label: 'Optimize', prompt: 'Optimize this code for better performance:' },
];

const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'models' | 'workspace' | 'appearance' | 'intro' | 'ai' | 'info' | 'repos'>('profile');
  const [settings, setSettings] = useState({
    theme: 'dark', profileName: 'YASSER-27', profileImage: '',
    country: 'Unknown', bio: '', systemPrompt: '', promptTemplates: [] as { label: string; prompt: string }[],
    followers: 0, following: 0, disableThinking: false, introEnabled: true,
    skillFiles: [] as { name: string; path: string; content: string }[],
    customWorkspace: '',
    aiModels: [] as { id: string; name: string; modelPath: string; mmprojPath?: string; isActive: boolean }[]
  });
  const [isStartingModel, setIsStartingModel] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [newTemplate, setNewTemplate] = useState({ label: '', prompt: '' });
  const [copyTask, setCopyTask] = useState<{ fileName: string; percent: number } | null>(null);

  useEffect(() => {
    if ((window as any).api?.onCopyProgress) {
      const unsub = (window as any).api.onCopyProgress((data: any) => {
        setCopyTask(data);
      });
      return () => unsub();
    }
  }, []);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [allRepos, setAllRepos] = useState<string[]>([]);
  const [selectedExport, setSelectedExport] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const loadRepos = async () => {
    if (window.api) {
      const r = await window.api.getRepos();
      setAllRepos(r);
    }
  };

  useEffect(() => {
    window.api?.getSettings().then((s: any) => {
      if (s) setSettings(prev => ({
        ...prev, ...s,
        promptTemplates: s.promptTemplates || []
      }));
      if (s?.theme) document.documentElement.setAttribute('data-theme', s.theme);
    });
    (window as any).api?.getStorageUsage?.().then((bytes: number) => setStorageUsed(bytes));
    loadRepos();
  }, []);

  const handleChangeWorkspace = async () => {
    const ok = await (window as any).api?.changeWorkspace();
    if (ok) {
      alert('Workspace changed successfully. Please reboot Gitbot completely for changes to apply.');
    }
  };

  const handleExportRepos = async () => {
    if (selectedExport.length === 0) return;
    setIsExporting(true);
    const success = await (window as any).api?.exportMultiRepos(selectedExport);
    setIsExporting(false);
    if (success) {
      setSelectedExport([]);
      alert(`Successfully exported ${selectedExport.length} repositories into a backup zip.`);
    }
  };

  const set = (key: string, val: any) => setSettings(prev => ({ ...prev, [key]: val }));

  const handleThemeChange = (theme: string) => {
    set('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  const handleSave = async () => {
    await window.api?.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleProfileImageUpload = async () => {
    const result = await (window as any).api?.uploadProfileImage();
    if (result) set('profileImage', result);
  };

  const insertTemplate = (prompt: string) => {
    set('systemPrompt', prompt);
    setActiveTab('ai');
  };

  const addTemplate = () => {
    if (!newTemplate.label.trim() || !newTemplate.prompt.trim()) return;
    set('promptTemplates', [...settings.promptTemplates, { ...newTemplate }]);
    setNewTemplate({ label: '', prompt: '' });
    setAddingTemplate(false);
  };

  const removeTemplate = (i: number) => {
    set('promptTemplates', settings.promptTemplates.filter((_, idx) => idx !== i));
  };

  // Storage meter percentage and color
  const usedPct = Math.min((storageUsed / STORAGE_LIMIT) * 100, 100);
  const storageColor = usedPct < 50 ? 'var(--green)' : usedPct < 80 ? 'var(--orange)' : 'var(--red)';
  const formatSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(2) + ' MB';
    return (b / 1024 ** 3).toFixed(2) + ' GB';
  };

  const TABS: { key: 'profile' | 'models' | 'workspace' | 'appearance' | 'intro' | 'ai' | 'info' | 'repos'; label: string; icon: any }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'models', label: 'Models', icon: Cpu },
    { key: 'workspace', label: 'Workspace', icon: HardDrive },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'intro', label: 'Intro Start', icon: Presentation },
    { key: 'ai', label: 'AI Config', icon: Cpu },
    { key: 'info', label: 'Info', icon: Info },
    { key: 'repos', label: 'Repositories', icon: Download },
  ];

  return (
    <div className="settings-page fade-in">
      {/* wa-tab-group placement="start" style vertical sidebar */}
      <div className="wa-tab-group">
        <div className="wa-tab-list" role="tablist" aria-orientation="vertical">
          <div className="wa-tab-group-label">Settings</div>
          {TABS.map(t => (
            <button key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              className={`wa-tab ${activeTab === t.key ? 'wa-tab--active' : ''}`}
              onClick={() => setActiveTab(t.key)}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="wa-tab-panels settings-main">
          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><User size={18} /> Profile</div>

              {/* Avatar */}
              <div className="profile-avatar-row">
                <div className="profile-avatar-wrap">
                  {settings.profileImage && (
                    <img
                      src={settings.profileImage}
                      alt="avatar"
                      className="profile-avatar-img"
                    />
                  )}
                  {!settings.profileImage && (
                    <div className="profile-avatar-placeholder">
                      {settings.profileName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <button className="profile-avatar-upload-btn" onClick={handleProfileImageUpload} title="Upload image">
                    <Upload size={14} />
                  </button>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{settings.profileName || 'User'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click the icon to change your photo</div>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Display name</label>
                  <input className="input" style={{ width: '100%' }} value={settings.profileName}
                    onChange={e => set('profileName', e.target.value)} placeholder="Your name" />
                </div>
                <div className="form-field">
                  <label className="form-label">Bio</label>
                  <textarea className="input" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                    value={settings.bio} onChange={e => set('bio', e.target.value)} placeholder="A short bio…" />
                </div>
                <div className="form-field">
                  <label className="form-label">Country / Location</label>
                  <input className="input" style={{ width: '100%' }} value={settings.country}
                    onChange={e => set('country', e.target.value)} placeholder="e.g. Morocco" />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-field" style={{ flex: 1 }}>
                    <label className="form-label">Followers</label>
                    <input type="number" className="input" style={{ width: '100%' }} value={settings.followers}
                      onChange={e => set('followers', parseInt(e.target.value) || 0)} min="0" />
                  </div>
                  <div className="form-field" style={{ flex: 1 }}>
                    <label className="form-label">Following</label>
                    <input type="number" className="input" style={{ width: '100%' }} value={settings.following}
                      onChange={e => set('following', parseInt(e.target.value) || 0)} min="0" />
                  </div>
                </div>
              </div>
              {/* Storage Meter stays in profile or move it? Let's leave it in Workspace. */}

              <button className={`button ${saved ? '' : 'button-primary'} save-btn`} onClick={handleSave}
                style={{ background: saved ? '#238636' : undefined }}>
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </section>
          )}

          {/* ── Models ── */}
          {activeTab === 'models' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><Cpu size={18} /> Model Connection</div>
              <p className="form-hint" style={{ marginBottom: '16px' }}>Manage your local AI models. Toggle a model to "On" to make it the active engine.</p>

              {copyTask && (
                <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Processing: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{copyTask.fileName}</span></span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{copyTask.percent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${copyTask.percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-color), #88bbff)', transition: 'width 0.2s ease-out' }} />
                  </div>
                </div>
              )}

              <button className="button button-primary" disabled={!!copyTask} style={{ marginBottom: '20px' }} onClick={async () => {
                const modelPath = await (window as any).api?.pickModelFile();
                if (modelPath) {
                  const mmprojPath = await (window as any).api?.pickMmprojFile(); // Optional
                  
                  // Copy files to local models directory
                  let localModelPath = modelPath;
                  let localMmprojPath = mmprojPath;

                  try {
                    const modelRes = await (window as any).api.copyAIModel(modelPath);
                    if (modelRes.success) localModelPath = modelRes.destPath;

                    if (mmprojPath) {
                      const mmRes = await (window as any).api.copyAIModel(mmprojPath);
                      if (mmRes.success) localMmprojPath = mmRes.destPath;
                    }
                  } catch (err) {
                    console.error('Copy failed:', err);
                  } finally {
                    setCopyTask(null);
                  }

                  const baseName = localModelPath.split(/[\\/]/).pop() || 'New Model';
                  const newModel = { 
                    id: Date.now().toString(), 
                    name: baseName, 
                    modelPath: localModelPath, 
                    mmprojPath: localMmprojPath || undefined,
                    isActive: (settings.aiModels || []).length === 0 // Active if first
                  };
                  set('aiModels', [...(settings.aiModels || []), newModel]);
                }
              }}>
                <Plus size={14} /> {copyTask ? 'Copying...' : 'Add Model Set'}
              </button>

              <div className="template-list">
                {(!settings.aiModels || settings.aiModels.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    No models added yet.
                  </div>
                ) : (
                  settings.aiModels.map((m, idx) => (
                    <div key={m.id} className={`template-item ${m.isActive ? 'active' : ''}`} style={{ padding: '12px 16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            className="template-label" 
                            style={{ 
                              fontWeight: 600, 
                              background: 'transparent', 
                              border: 'none', 
                              color: 'inherit',
                              padding: '0',
                              margin: '0',
                              outline: 'none',
                              width: 'auto',
                              minWidth: '50px'
                            }}
                            value={m.name}
                            onChange={(e) => {
                              const newModels = [...settings.aiModels];
                              newModels[idx].name = e.target.value;
                              set('aiModels', newModels);
                            }}
                            title="Click to rename"
                          />
                          <span style={{ 
                            fontSize: '9px', 
                            background: m.mmprojPath ? 'var(--accent-color)' : 'var(--bg-tertiary)', 
                            color: m.mmprojPath ? 'white' : 'var(--text-secondary)', 
                            padding: '1px 5px', 
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            fontWeight: 'bold',
                            border: m.mmprojPath ? 'none' : '1px solid var(--border-color)'
                          }}>
                            {m.mmprojPath ? 'Vision' : 'Text'}
                          </span>
                        </div>
                        <div className="template-preview" style={{ fontSize: '11px', opacity: 0.7, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.modelPath}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: m.isActive ? 'var(--green)' : 'var(--text-secondary)' }}>
                            {m.isActive ? 'ON' : 'OFF'}
                          </span>
                          <label className="toggle-switch">
                            <input 
                              type="checkbox" 
                              style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} 
                              checked={m.isActive} 
                              onChange={() => {
                                const newModels = settings.aiModels.map((item, i) => ({
                                  ...item,
                                  isActive: i === idx
                                }));
                                set('aiModels', newModels);
                                // If toggled on, immediately try to start it for feedback
                                if (!m.isActive) {
                                  setIsStartingModel(m.id);
                                  (window as any).api?.startAI(m.modelPath, m.mmprojPath).finally(() => {
                                    // Give it a bit of time to report ready or fail
                                    setTimeout(() => setIsStartingModel(null), 2000);
                                  });
                                }
                              }}

                            />
                            <span className="slider round"></span>
                          </label>
                          {isStartingModel === m.id && <Loader size={14} className="ai-spin" style={{ color: 'var(--accent-color)' }} />}
                        </div>

                        
                        <button className="button button-danger" style={{ padding: '4px', height: '28px', width: '28px' }}
                          onClick={async () => {
                            if (confirm(`Remove model set "${m.name}"? This will also delete the local copy.`)) {
                              if (m.modelPath) await (window as any).api?.deleteModelFile(m.modelPath);
                              if (m.mmprojPath) await (window as any).api?.deleteModelFile(m.mmprojPath);
                              set('aiModels', settings.aiModels.filter(item => item.id !== m.id));
                            }
                          }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className={`button ${saved ? '' : 'button-primary'} save-btn`} onClick={handleSave}
                style={{ background: saved ? '#238636' : undefined, marginTop: '24px' }}>
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </section>
          )}

          {/* ── Workspace ── */}
          {activeTab === 'workspace' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><HardDrive size={18} /> Workspace & Storage</div>

              <div className="form-field" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: 0 }}>Use Default Storage Path</label>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Save everything to <code>~/.gitbot/</code> by default.
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                      checked={!settings.customWorkspace}
                      onChange={e => {
                        const useDefault = e.target.checked;
                        if (useDefault) {
                          if (confirm('Revert to default storage path? (Requires Restart)')) {
                            setSettings(p => ({ ...p, customWorkspace: '' }));
                            (window as any).api?.changeWorkspaceDefault?.();
                          }
                        } else {
                          handleChangeWorkspace();
                        }
                      }}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {!settings.customWorkspace ? (
                  <div className="form-hint" style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>Active path: <code>C:\Users\username\.gitbot</code></div>
                ) : (
                  <div className="form-hint" style={{ padding: '12px', background: 'rgba(96, 165, 250, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '6px', color: 'var(--accent-color)' }}>
                    Custom Workspace enabled. Path: <code>{settings.customWorkspace || 'Custom Path'}</code>
                  </div>
                )}
              </div>

              {/* Storage Meter */}
              <div className="storage-card" style={{ marginTop: '24px' }}>
                <div className="storage-card-header">
                  <HardDrive size={16} />
                  <span>Storage Usage</span>
                  <span className="storage-badge" style={{ color: storageColor }}>
                    {formatSize(storageUsed)} / 5 GB
                  </span>
                </div>
                <div className="storage-meter">
                  <div className="storage-meter-fill" style={{ width: `${usedPct}%`, background: storageColor }} />
                </div>
                <div className="storage-footer">
                  {usedPct.toFixed(1)}% used &nbsp;·&nbsp; {formatSize(STORAGE_LIMIT - storageUsed)} free
                </div>
              </div>

              <button className={`button ${saved ? '' : 'button-primary'} save-btn`} onClick={handleSave}
                style={{ background: saved ? '#238636' : undefined, marginTop: '24px' }}>
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </section>
          )}

          {/* ── Appearance ── */}
          {activeTab === 'appearance' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><Palette size={18} /> Appearance</div>
              <label className="form-label">Theme</label>
              <div className="theme-grid">
                {THEMES.map(t => (
                  <div key={t.value} className={`theme-card ${settings.theme === t.value ? 'active' : ''}`}
                    onClick={() => handleThemeChange(t.value)}>
                    <div className="theme-preview" style={{ background: t.bg }}>
                      <div className="theme-bar" style={{ background: t.accent }} />
                    </div>
                    <div className="theme-card-footer">
                      <span className="theme-label">{t.label}</span>
                      {settings.theme === t.value && <CheckCircle size={14} color="var(--accent-color)" />}
                    </div>
                    <div className="theme-desc">{t.desc}</div>
                  </div>
                ))}
              </div>

              <button className={`button ${saved ? '' : 'button-primary'} save-btn`} onClick={handleSave}
                style={{ marginTop: '24px', background: saved ? '#238636' : undefined }}>
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </section>
          )}

          {/* ── Intro Start ── */}
          {activeTab === 'intro' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><Presentation size={18} /> Intro Animation</div>

              <div className="form-field" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: 0 }}>Intro Animation</label>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Show the 3-second startup animation.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} checked={settings.introEnabled !== false} onChange={e => set('introEnabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            </section>
          )}


          {/* ── AI Config ── */}
          {activeTab === 'ai' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><Cpu size={18} /> AI Configuration</div>

              <div className="form-field" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label className="form-label">Thinking Mode</label>
                    <p className="form-hint">Enable or disable the AI's internal reasoning process. Disabling it forces faster, direct responses.</p>
                  </div>
                  <button
                    className={`button ${!settings.disableThinking ? 'button-primary' : ''}`}
                    onClick={() => set('disableThinking', !settings.disableThinking)}
                  >
                    {settings.disableThinking ? 'Off' : 'On'}
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">System Prompt</label>
                <p className="form-hint">Define the AI personality and behavior.</p>
                <textarea className="input" style={{ width: '100%', minHeight: '130px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                  value={settings.systemPrompt}
                  onChange={e => set('systemPrompt', e.target.value)}
                  placeholder="You are a professional assistant…" />
              </div>

              {/* Template Prompts */}
              <div className="form-field" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: 0 }}>Template Prompts</label>
                    <p className="form-hint" style={{ marginTop: '2px' }}>Click a template to set it as your System Prompt.</p>
                  </div>
                  <button className="button" style={{ fontSize: '12px' }} onClick={() => setAddingTemplate(v => !v)}>
                    <Plus size={13} /> Add
                  </button>
                </div>

                {addingTemplate && (
                  <div className="template-add-form">
                    <input className="input" placeholder="Template name"
                      value={newTemplate.label} onChange={e => setNewTemplate(p => ({ ...p, label: e.target.value }))} />
                    <textarea className="input" placeholder="Prompt text…" style={{ minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                      value={newTemplate.prompt} onChange={e => setNewTemplate(p => ({ ...p, prompt: e.target.value }))} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="button button-primary" style={{ fontSize: '13px' }} onClick={addTemplate}>Save</button>
                      <button className="button" style={{ fontSize: '13px' }} onClick={() => setAddingTemplate(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                <div className="template-list">
                  {[...DEFAULT_TEMPLATES, ...settings.promptTemplates].map((t, i) => (
                    <div key={i} className="template-item">
                      <div>
                        <div className="template-label">{t.label}</div>
                        <div className="template-preview">{t.prompt.slice(0, 80)}…</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button className="button" style={{ fontSize: '12px' }} onClick={() => insertTemplate(t.prompt)}>
                          Use
                        </button>
                        {i >= DEFAULT_TEMPLATES.length && (
                          <button className="button button-danger" style={{ fontSize: '12px' }}
                            onClick={() => removeTemplate(i - DEFAULT_TEMPLATES.length)}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="form-field" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>AI Skills & Knowledge</h3>
                    <p className="form-hint" style={{ marginTop: '2px' }}>Load specialized files (.md, .txt) as context to give the AI new skills.</p>
                  </div>
                  <button className="button" style={{ fontSize: '12px' }} onClick={async () => {
                    const skills = await (window as any).api?.pickSkillFiles?.();
                    if (skills) setSettings(s => ({ ...s, skillFiles: [...s.skillFiles, ...skills] }));
                  }}>
                    <Plus size={12} /> Add Skills
                  </button>
                </div>

                <div className="template-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {settings.skillFiles?.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                      No skills loaded.
                    </div>
                  ) : settings.skillFiles?.map((skill, idx) => (
                    <div key={idx} className="template-item" style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="skill-icon-wrap" style={{
                          width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(47,129,247,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)'
                        }}>
                          <FileCode size={16} />
                        </div>
                        <div>
                          <div className="template-label" style={{ margin: 0, fontWeight: 600 }}>{skill.name}</div>
                          <div className="template-preview" style={{ fontSize: '11px', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skill.path}</div>
                        </div>
                      </div>
                      <button className="button button-danger" style={{ padding: '4px', height: '28px', width: '28px' }}
                        onClick={() => setSettings(s => ({ ...s, skillFiles: s.skillFiles.filter((_, i) => i !== idx) }))}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button className={`button ${saved ? '' : 'button-primary'} save-btn`} onClick={handleSave}
                style={{ background: saved ? '#238636' : undefined }}>
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </section>
          )}

          {/* ── Info ── */}
          {activeTab === 'info' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><Info size={18} /> About Gitbot</div>
              <div className="info-card">
                <img src={gitbotLogo} alt="Gitbot" className="info-logo" />
                <div className="info-content">
                  <h2 className="info-title">Gitbot</h2>
                  <p className="info-version">v1.2.0 </p>
                  <p className="info-desc">
                    Gitbot is a professional offline-first project manager powered by local AI. Store, organize,
                    and manage all your code projects without ever leaving your machine. Use simple CLI commands
                    via <code>gbot</code> or the full GUI to commit, release, and chat with your AI copilot.
                  </p>
                  <div className="info-features">
                    <div className="info-feature-item">Local AI inference — 100% offline</div>
                    <div className="info-feature-item">Full project management with commits &amp; releases</div>
                    <div className="info-feature-item">AI-powered project scaffolding with /plan</div>
                    <div className="info-feature-item">CLI + GUI workflow in one tool</div>
                  </div>
                </div>
              </div>

              <div className="dev-card" style={{ marginBottom: '24px' }}>
                <div className="dev-avatar" style={{ background: 'transparent' }}>
                  <img src={gitbotLogo} alt="Y" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div className="dev-name">YASSER-27</div>
                  <div className="dev-title">Developer &amp; Designer</div>
                  <a href="https://github.com/YASSER-27" target="_blank" rel="noreferrer"
                    className="dev-link">
                    <ExternalLink size={13} /> github.com/YASSER-27
                  </a>
                </div>
              </div>

              <div className="info-docs">
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Presentation size={18} />
                  Quick Guide
                </h3>
                <div className="docs-grid">
                  <div className="docs-card">
                    <h4>Global Hotkeys</h4>
                    <ul>
                      <li><code>F9</code> — Toggle window visibility</li>
                      <li><code>Ctrl + R</code> — Force reload application</li>
                      <li><code>Ctrl + F</code> — Search current view</li>
                    </ul>
                  </div>

                  <div className="docs-card">
                    <h4> AI Commands</h4>
                    <ul>
                      <li><code>/plan </code> — AI project scaffolding</li>
                      <li><code>/thinking</code> — analyze deeply before answering</li>
                      <li><code>/diagram</code> — Draw Mermaid/SVG</li>
                      <li><code>/model</code> — Switch local model file</li>
                    </ul>
                  </div>

                  <div className="docs-card">
                    <h4>CLI (gbot)</h4>
                    <ul>
                      <li><code>gbot commit "msg"</code> — Fast snapshot</li>
                      <li><code>gbot release v1.2</code> — Tag a release</li>
                      <li><code>gbot status</code> — View folder delta</li>
                    </ul>
                  </div>

                  <div className="docs-card">
                    <h4> Pro Features</h4>
                    <ul>
                      <li>Drag folders to project sidebar</li>
                      <li>Toggle "Thinking Mode" in Settings</li>
                      <li>Customize AI Skills in Config</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Manage Repositories ── */}
          {activeTab === 'repos' && (
            <section className="settings-section fade-in">
              <div className="settings-section-title"><Download size={18} /> Manage Repositories</div>
              <p className="form-hint" style={{ marginBottom: '16px' }}>Select one or more repositories to export as a unified ZIP archive for backup or sharing.</p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button className="button" style={{ fontSize: '12px' }} onClick={() => setSelectedExport(allRepos.length === selectedExport.length ? [] : [...allRepos])}>
                  {allRepos.length === selectedExport.length && allRepos.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                <button className="button button-primary" style={{ fontSize: '12px' }} onClick={handleExportRepos} disabled={selectedExport.length === 0 || isExporting}>
                  {isExporting ? <Loader size={12} className="ai-spin" /> : <Download size={12} />}
                  Export ({selectedExport.length})
                </button>
              </div>

              <div className="template-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {allRepos.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No repositories found.
                  </div>
                ) : allRepos.map(repo => (
                  <div key={repo} className="template-item" style={{ padding: '10px 14px', cursor: 'pointer' }}
                    onClick={() => setSelectedExport(prev => prev.includes(repo) ? prev.filter(r => r !== repo) : [...prev, repo])}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '18px', height: '18px', border: '1px solid var(--border-color)', borderRadius: '3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: selectedExport.includes(repo) ? 'var(--accent-color)' : 'transparent', flexShrink: 0
                      }}>
                        {selectedExport.includes(repo) && <CheckSquare size={12} fill="#fff" color="#fff" />}
                      </div>
                      <div className="template-label" style={{ margin: 0, fontSize: '14px' }}>{repo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
