import { useState, useEffect } from 'react';
import { User, Palette, Save, CheckCircle, Upload, Info, Cpu, HardDrive, ExternalLink, Plus, X, Presentation } from 'lucide-react';
import gitbotLogo from '../assets/gitbot.png';
import './Settings.css';
import './Templates.css';

const THEMES = [
  { value: 'dark',            label: 'Dark',        desc: 'GitHub dark default',       bg: '#0d1117', accent: '#2f81f7' },
  { value: 'light',           label: 'Light',       desc: 'Clean light theme',         bg: '#ffffff', accent: '#0969da' },
  { value: 'github',          label: 'GitHub Deep', desc: 'Deep dark extra vibrant',   bg: '#010409', accent: '#2f81f7' },
  { value: 'modern-dark',     label: 'Dark #181818',desc: 'Pure flat dark minimal',    bg: '#181818', accent: '#60a5fa' },
  { value: 'modern-glass',    label: 'Glass',       desc: 'Frosted glassmorphism',     bg: '#0f1420', accent: '#818cf8' },
  { value: 'modern-aurora',   label: 'Aurora',      desc: 'Animated space pulse',      bg: '#08081a', accent: '#7c6ae8' },
  { value: 'modern-midnight', label: 'Midnight',    desc: 'Animated warm gold',        bg: '#06070f', accent: '#f5a623' },
  { value: 'modern-crimson',  label: 'Crimson',     desc: 'Animated emerald red',      bg: '#0a0608', accent: '#e53e5b' },
  { value: 'modern-neon',     label: 'Neon',        desc: 'Animated cyan & pink',      bg: '#050505', accent: '#00ffff' },
  { value: 'modern-synthwave',label: 'Synth',       desc: 'Animated 80s purple',       bg: '#090314', accent: '#ff8c00' },
  { value: 'modern-ocean',    label: 'Ocean',       desc: 'Animated deep blue',        bg: '#020b14', accent: '#38bdf8' },
  { value: 'modern-forest',   label: 'Forest',      desc: 'Deep green nature',         bg: '#071010', accent: '#34d399' },
  { value: 'modern-copper',   label: 'Copper',      desc: 'Warm bronze dark',          bg: '#100b06', accent: '#cd7f32' },
  { value: 'modern-rose',     label: 'Rose',        desc: 'Soft pink mauve dark',      bg: '#120a0e', accent: '#f472b6' },
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
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'intro' | 'ai' | 'info'>('profile');
  const [settings, setSettings] = useState({
    theme: 'dark', profileName: 'YASSER-27', profileImage: '',
    country: 'Unknown', bio: '', systemPrompt: '', promptTemplates: [] as { label: string; prompt: string }[],
    followers: 0, following: 0, disableThinking: false, introEnabled: true
  });
  const [saved, setSaved] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [newTemplate, setNewTemplate] = useState({ label: '', prompt: '' });
  const [addingTemplate, setAddingTemplate] = useState(false);

  useEffect(() => {
    window.api?.getSettings().then((s: any) => {
      if (s) setSettings(prev => ({
        ...prev, ...s,
        promptTemplates: s.promptTemplates || []
      }));
      if (s?.theme) document.documentElement.setAttribute('data-theme', s.theme);
    });
    (window as any).api?.getStorageUsage?.().then((bytes: number) => setStorageUsed(bytes));
  }, []);

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

  const TABS: { key: 'profile' | 'appearance' | 'intro' | 'ai' | 'info'; label: string; icon: any }[] = [
    { key: 'profile',    label: 'Profile',     icon: User    },
    { key: 'appearance', label: 'Appearance',  icon: Palette },
    { key: 'intro',      label: 'Intro Start', icon: Presentation },
    { key: 'ai',         label: 'AI Config',   icon: Cpu     },
    { key: 'info',       label: 'Info',        icon: Info    },
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

            {/* Storage Meter */}
            <div className="storage-card">
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
              style={{ background: saved ? '#238636' : undefined }}>
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
                <p className="info-version">v1.0.0 — Local AI Git Manager</p>
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

            <div className="dev-card">
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
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
