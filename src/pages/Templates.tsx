import { useState, useEffect } from 'react';
import { LayoutTemplate, Plus } from 'lucide-react';
import './Settings.css';
import './Templates.css';

export default function Templates() {
  const [settings, setSettings] = useState<any>({ promptTemplates: [] });
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ label: '', prompt: '' });

  useEffect(() => {
    window.api?.getSettings().then((s: any) => {
      if (s) setSettings((prev: any) => ({ ...prev, ...s, promptTemplates: s.promptTemplates || [] }));
    });
  }, []);

  const addTemplate = () => {
    if (!newTemplate.label.trim() || !newTemplate.prompt.trim()) return;
    const newTemplates = [...settings.promptTemplates, { ...newTemplate }];
    setSettings({ ...settings, promptTemplates: newTemplates });
    window.api?.saveSettings({ ...settings, promptTemplates: newTemplates });
    setNewTemplate({ label: '', prompt: '' });
    setAddingTemplate(false);
  };

  const removeTemplate = (i: number) => {
    const newTemplates = settings.promptTemplates.filter((_: any, idx: number) => idx !== i);
    setSettings({ ...settings, promptTemplates: newTemplates });
    window.api?.saveSettings({ ...settings, promptTemplates: newTemplates });
  };

  return (
    <div className="settings-page fade-in" style={{ justifyContent: 'center' }}>
      <div className="settings-main" style={{ maxWidth: '1000px', flex: 1, padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', margin: 0, color: 'var(--text-primary)' }}>
              <LayoutTemplate size={24} /> Templates
            </h1>
            <p className="form-hint" style={{ marginTop: '8px', fontSize: '14px' }}>
              Save and manage any text, code snippets, or prompts.
            </p>
          </div>
          <button className="button button-primary" onClick={() => setAddingTemplate(true)}>
            <Plus size={14} /> New Template
          </button>
        </div>

        {addingTemplate && (
          <div className="template-add-form fade-in" style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', marginBottom: '32px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Create New Template</h3>
            <input className="input" placeholder="Template Title (e.g. Code Review)"
              value={newTemplate.label} onChange={e => setNewTemplate(p => ({ ...p, label: e.target.value }))} style={{ width: '100%', marginBottom: '16px' }} />
            <textarea className="input" placeholder="Prompt text…" style={{ width: '100%', minHeight: '100px', resize: 'vertical', fontSize: '14px', marginBottom: '16px' }}
              value={newTemplate.prompt} onChange={e => setNewTemplate(p => ({ ...p, prompt: e.target.value }))} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button button-primary" onClick={addTemplate}>Save Template</button>
              <button className="button" onClick={() => setAddingTemplate(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="wa-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Custom user templates */}
          {settings.promptTemplates.map((t: any, i: number) => (
            <details key={`user-${i}`} style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', outline: 'none' }}>
                {t.label}
              </summary>
              <div style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '14px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', background: 'var(--bg-color)', padding: '12px', borderRadius: '6px' }}>
                {t.prompt}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="button" onClick={() => navigator.clipboard.writeText(t.prompt)} type="button" style={{ fontSize: '12px' }}>Copy</button>
                  <button className="button" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '12px' }} onClick={() => removeTemplate(i)} type="button">Delete</button>
                </div>
              </div>
            </details>
          ))}
          {settings.promptTemplates.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <LayoutTemplate size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>No templates yet — click <strong>New</strong> to add your first one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
