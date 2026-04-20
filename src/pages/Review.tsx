import { useState, useRef } from 'react';
import { FileText, Code, File, BarChart2, Download, Trash2, Plus } from 'lucide-react';
import Markdown from '../components/Markdown';
import './Review.css';

type FileType = 'readme' | 'html' | 'csv';

interface DocFile {
  id: string;
  name: string;
  type: FileType;
  content: string;
}

const STARTERS: Record<FileType, string> = {
  readme: `# My Project\n\n> A short tagline or description.\n\n## Features\n\n- Feature one\n- Feature two\n- Feature three\n\n## Installation\n\n\`\`\`bash\nnpm install my-project\n\`\`\`\n\n## Usage\n\n\`\`\`javascript\nimport myProject from 'my-project';\nmyProject.run();\n\`\`\`\n\n## License\n\nMIT\n`,
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>My Page</title>\n  <style>\n    body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }\n    h1 { color: #2563eb; }\n  </style>\n</head>\n<body>\n  <h1>Hello World</h1>\n  <p>This is your HTML page. Edit the left panel to see changes here.</p>\n</body>\n</html>`,
  csv: `Name,Age,Country,Score\nAlice,28,Morocco,95\nBob,34,USA,87\nCarlos,22,Spain,92\nDiana,30,France,88\n`,
};

const TYPE_ICONS: Record<FileType, any> = {
  readme: FileText,
  html: Code,
  csv: BarChart2,
};

const TYPE_LABELS: Record<FileType, string> = {
  readme: 'README.md',
  html: 'HTML Page',
  csv: 'CSV Data',
};

function CsvPreview({ content }: { content: string }) {
  const lines = content.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>No data</div>;
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(l => l.split(','));
  return (
    <div style={{ overflowX: 'auto', padding: '16px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-tertiary)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>{h.trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{cell.trim()}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Review() {
  const [files, setFiles] = useState<DocFile[]>([
    { id: '1', name: 'README.md', type: 'readme', content: STARTERS.readme },
  ]);
  const [activeId, setActiveId] = useState('1');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const SNIPPETS = [
    { label: 'Title H1', text: '# ' },
    { label: 'Title H2', text: '## ' },
    { label: 'Bold', text: '**text**' },
    { label: 'List', text: '- item\n- item' },
    { label: 'Table', text: '| Title | Info |\n|---|---|\n| Item | Val |' },
    { label: 'Code Block', text: '```javascript\n\n```' },
    { label: 'Link', text: '[text](url)' },
    { label: 'Image', text: '![alt](url)' },
    { label: 'HTML Div', text: '<div class="">\n\n</div>' },
    { label: 'CSV Row', text: 'Name,Value,Status\n' },
  ];

  const active = files.find(f => f.id === activeId) || files[0];

  const addFile = (type: FileType) => {
    const id = Date.now().toString();
    const name = type === 'readme' ? `README-${id.slice(-4)}.md` : type === 'html' ? `page-${id.slice(-4)}.html` : `data-${id.slice(-4)}.csv`;
    const newFile: DocFile = { id, name, type, content: STARTERS[type] };
    setFiles(prev => [...prev, newFile]);
    setActiveId(id);
  };

  const updateContent = (val: string) => {
    setFiles(prev => prev.map(f => f.id === activeId ? { ...f, content: val } : f));
  };

  const deleteFile = (id: string) => {
    const remaining = files.filter(f => f.id !== id);
    setFiles(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id || '');
  };

  const downloadFile = () => {
    if (!active) return;
    const blob = new Blob([active.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = active.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="review-page fade-in">
      {/* Sidebar */}
      <aside className="review-sidebar">
        <div className="review-sidebar-header">
          <span className="review-sidebar-title">Documents</span>
        </div>

        <div className="review-file-list">
          {files.map(f => {
            const Icon = TYPE_ICONS[f.type];
            return (
              <div
                key={f.id}
                className={`review-file-item ${activeId === f.id ? 'active' : ''}`}
                onClick={() => { setActiveId(f.id); }}
              >
                <Icon size={14} />
                <span className="review-file-name">{f.name}</span>
                <button className="review-file-delete" onClick={e => { e.stopPropagation(); deleteFile(f.id); }}>
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="review-sidebar-new">
          <p className="review-sidebar-new-label">Add New</p>
          <button className="review-new-btn" onClick={() => addFile('readme')}>
            <FileText size={13} /> README
          </button>
          <button className="review-new-btn" onClick={() => addFile('html')}>
            <Code size={13} /> HTML Page
          </button>
          <button className="review-new-btn" onClick={() => addFile('csv')}>
            <BarChart2 size={13} /> CSV Data
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="review-main">
        {active ? (
          <>
            {/* Toolbar */}
            <div className="review-toolbar">
              <div className="review-file-label">
                {(() => { const Icon = TYPE_ICONS[active.type]; return <Icon size={15} />; })()}
                <span>{active.name}</span>
                <span className="review-type-badge">{TYPE_LABELS[active.type]}</span>
              </div>
              <div className="review-toolbar-actions">
                <button className="button button-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={downloadFile}>
                  <Download size={13} /> Export
                </button>
              </div>
            </div>

            {/* Split Content */}
            <div className="review-content split-view">
              <div className="review-editor-pane">
                <div className="review-snippets">
                  {SNIPPETS.map(s => (
                    <button key={s.label} className="snippet-btn" onClick={() => {
                      if (!textareaRef.current) return;
                      const start = textareaRef.current.selectionStart;
                      const end = textareaRef.current.selectionEnd;
                      const val = active.content;
                      const updated = val.substring(0, start) + s.text + val.substring(end);
                      updateContent(updated);
                      setTimeout(() => {
                        textareaRef.current?.focus();
                        textareaRef.current?.setSelectionRange(start + s.text.length, start + s.text.length);
                      }, 0);
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  className="review-editor"
                  value={active.content}
                  onChange={e => updateContent(e.target.value)}
                  spellCheck={false}
                  placeholder="Start typing…"
                />
              </div>
              
              <div className="review-preview-pane">
                <div className="preview-label">Live Preview</div>
                <div className="review-preview">
                  {active.type === 'readme' && (
                    <div className="markdown-body" style={{ padding: '24px' }}>
                      <Markdown content={active.content} />
                    </div>
                  )}
                  {active.type === 'html' && (
                    <iframe
                      srcDoc={active.content}
                      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                      sandbox="allow-scripts"
                      title="HTML Preview"
                    />
                  )}
                  {active.type === 'csv' && <CsvPreview content={active.content} />}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="review-empty">
            <File size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
            <h3>No Document Selected</h3>
            <p>Create a new document from the sidebar on the left.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              <button className="button button-primary" onClick={() => addFile('readme')}><Plus size={14} /> README</button>
              <button className="button" onClick={() => addFile('html')}><Plus size={14} /> HTML</button>
              <button className="button" onClick={() => addFile('csv')}><Plus size={14} /> CSV</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
