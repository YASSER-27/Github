import { useState, useEffect } from 'react';
import { Globe, FolderOpen, Play, Loader, Code2, ExternalLink } from 'lucide-react';
import './Pages.css';

interface PageEntry {
  repoName: string;
  filePath: string;
  fileName: string;
  hasJs: boolean;
  hasCss: boolean;
  isApp: boolean; // true if it has linked resources (more likely a real page)
  preview?: string; // first title found
}

const HTML_PAGE_PATTERNS = [
  /<title[^>]*>([^<]+)<\/title>/i,
  /<h1[^>]*>([^<]+)<\/h1>/i,
];

const EXCLUDED_NAMES = ['email', 'template', 'component', 'partial', 'snippet', 'fragment'];

function looksLikePage(content: string, fileName: string): { isPage: boolean; isApp: boolean; preview: string } {
  const lowerName = fileName.toLowerCase();
  const isExcluded = EXCLUDED_NAMES.some(e => lowerName.includes(e));
  if (isExcluded) return { isPage: false, isApp: false, preview: '' };

  const hasDoctype = /<!DOCTYPE\s+html/i.test(content);
  const hasHtmlTag = /<html[\s>]/i.test(content);
  const hasBody = /<body[\s>]/i.test(content);
  const isPage = (hasDoctype || hasHtmlTag) && hasBody;

  const hasScriptSrc = /<script[^>]+src=/i.test(content);
  const hasLinkHref = /<link[^>]+href=/i.test(content);
  const isApp = isPage && (hasScriptSrc || hasLinkHref);

  let preview = '';
  for (const p of HTML_PAGE_PATTERNS) {
    const m = content.match(p);
    if (m?.[1]) { preview = m[1].trim(); break; }
  }
  if (!preview) preview = fileName.replace('.html', '').replace(/-/g, ' ');

  return { isPage, isApp, preview };
}

export default function Pages() {
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [previewRepo, setPreviewRepo] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  useEffect(() => {
    scanAllRepos();
  }, []);

  const scanAllRepos = async () => {
    setLoading(true);
    setError('');
    try {
      const repos: string[] = await (window as any).api?.getRepos() || [];
      const found: PageEntry[] = [];

      for (const repo of repos) {
        await scanDir(repo, '', found);
      }

      setPages(found);
    } catch (e) {
      setError('Failed to scan repositories');
    }
    setLoading(false);
  };

  const scanDir = async (repo: string, subPath: string, found: PageEntry[], depth = 0) => {
    if (depth > 4) return;
    try {
      const files = await (window as any).api?.getRepoFiles(repo, subPath) || [];
      for (const f of files) {
        if (f.isDirectory && !['node_modules', '.git', 'dist', 'build', '.next'].includes(f.name)) {
          await scanDir(repo, f.path, found, depth + 1);
        } else if (!f.isDirectory && f.name.toLowerCase().endsWith('.html')) {
          try {
            const content = await (window as any).api?.getFileContent(repo, f.path);
            if (content) {
              const { isPage, isApp, preview } = looksLikePage(content, f.name);
              if (isPage) {
                const hasJs = /<script/i.test(content);
                const hasCss = /<style|<link[^>]+\.css/i.test(content);
                found.push({
                  repoName: repo,
                  filePath: f.path,
                  fileName: f.name,
                  hasJs, hasCss, isApp, preview,
                });
              }
            }
          } catch {}
        }
      }
    } catch {}
  };

  const openPage = async (repo: string, filePath: string) => {
    await (window as any).api?.openFile(repo, filePath);
  };

  if (loading) {
    return (
      <div className="pages-container pages-loading fade-in">
        <Loader size={32} className="fa-spin" />
        <p>Scanning repositories for HTML pages…</p>
      </div>
    );
  }

  return (
    <div className="pages-container fade-in">
      <div className="pages-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', margin: 0 }}>
            <Globe size={24} color="var(--accent-color)" /> Pages
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            HTML pages detected across your repositories — {pages.length} found
          </p>
        </div>
        <button className="button button-primary" onClick={scanAllRepos} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader size={14} /> Refresh
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="pages-empty">
          <Globe size={48} color="var(--text-secondary)" />
          <h2>No pages found</h2>
          <p>Create HTML files in your repositories — Gitbot will detect them automatically.</p>
        </div>
      ) : (
        <div className="pages-grid">
          {pages.map((page, i) => (
            <div key={i} className={`page-card ${page.isApp ? 'page-card--app' : ''}`}>
              <div className="page-card-preview" onClick={() => {
                setPreviewRepo(page.repoName);
                setPreviewFile(page.filePath);
              }}>
                {previewRepo === page.repoName && previewFile === page.filePath ? (
                  <iframe
                    src={`gitbot-repo://${page.repoName}/${page.filePath}`}
                    title={page.preview}
                    sandbox="allow-scripts allow-same-origin"
                    style={{ border: 'none', transform: 'scale(0.65)', transformOrigin: 'top left', width: '154%', height: '154%' }}
                  />
                ) : (
                  <div className="page-card-thumb">
                    <Code2 size={40} color="var(--border-color)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Click to preview</span>
                  </div>
                )}
              </div>

              <div className="page-card-body">
                <div className="page-card-title">{page.preview}</div>
                <div className="page-card-path">
                  <FolderOpen size={12} /> {page.repoName} / {page.filePath}
                </div>
                <div className="page-card-tags">
                  {page.isApp && <span className="page-tag page-tag--app">App</span>}
                  {page.hasJs && <span className="page-tag page-tag--js">JS</span>}
                  {page.hasCss && <span className="page-tag page-tag--css">CSS</span>}
                  {!page.isApp && !page.hasJs && !page.hasCss && <span className="page-tag">Static</span>}
                </div>
                <div className="page-card-actions">
                  <button className="button" style={{ fontSize: '12px' }} onClick={() => openPage(page.repoName, page.filePath)}>
                    <ExternalLink size={13} /> Open
                  </button>
                  <button className="button button-primary" style={{ fontSize: '12px' }} onClick={() => {
                    if (previewRepo === page.repoName && previewFile === page.filePath) {
                      setPreviewRepo(null); setPreviewFile(null);
                    } else {
                      setPreviewRepo(page.repoName); setPreviewFile(page.filePath);
                    }
                  }}>
                    <Play size={13} /> {previewRepo === page.repoName && previewFile === page.filePath ? 'Close' : 'Preview'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
