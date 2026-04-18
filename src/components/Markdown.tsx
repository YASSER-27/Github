import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { createHighlighter, type HighlighterCore, bundledLanguages, bundledThemes } from 'shiki';
import { Check, Copy, ExternalLink, Download } from 'lucide-react';
import './Markdown.css';

interface MarkdownProps {
  content: string;
  isStreaming?: boolean;
  repoName?: string;
}

let highlighter: HighlighterCore | null = null;
createHighlighter({
  themes: [bundledThemes['github-dark']],
  langs: [...Object.keys(bundledLanguages)],
}).then(h => { highlighter = h; });

// File extensions that can be opened directly
const OPENABLE_EXTS = ['html', 'htm', 'txt', 'csv', 'py', 'js', 'ts', 'json', 'md', 'xml', 'yaml', 'yml'];

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : 'text';
  const code = String(children).replace(/\n$/, '');
  const [html, setHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (highlighter && match) {
      try {
        setHtml(highlighter.codeToHtml(code, { lang, theme: 'github-dark' }));
      } catch { setHtml(''); }
    }
  }, [code, lang, match]);

  // Inline code — render as-is
  if (inline || !match) {
    return <code className={`inline-code ${className || ''}`} {...props}>{children}</code>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    const ext = OPENABLE_EXTS.includes(lang) ? lang : 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `code.${ext}`;
    a.click(); URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleOpen = () => {
    const ext = OPENABLE_EXTS.includes(lang) ? lang : 'txt';
    const blob = new Blob([code], { type: ext === 'html' ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const canOpen = OPENABLE_EXTS.includes(lang);

  return (
    <div className="code-block-wrapper">
      <div className="code-header">
        <span className="code-lang-badge">{lang}</span>
        <div className="code-header-actions">
          {canOpen && (
            <button onClick={handleOpen} className="code-action-btn" title="Open in browser">
              <ExternalLink size={13} /> Open
            </button>
          )}
          <button onClick={handleSave} className="code-action-btn" title="Save file">
            {saved ? <Check size={13} color="var(--green)" /> : <Download size={13} />}
            {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={handleCopy} className="code-action-btn" title="Copy code">
            {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} className="shiki-code" />
      ) : (
        <pre className="code-fallback"><code>{children}</code></pre>
      )}
    </div>
  );
};

/** Custom paragraph — use div to prevent invalid nesting when code blocks appear inside */
const Para = ({ children }: any) => <div className="md-p">{children}</div>;
const Anchor = ({ href, children, ...props }: any) => (
  <a 
    href={href} 
    onClick={(e) => {
      e.preventDefault();
      if (href && href.startsWith('http')) window.open(href, '_blank');
    }}
    {...props}
  >
    {children}
  </a>
);

export default function Markdown({ content, isStreaming, repoName }: MarkdownProps) {
  const transformImageUri = (uri: string) => {
    if (uri.startsWith('http') || uri.startsWith('data:')) return uri;
    if (repoName) return `gitbot-repo://${repoName}/${uri.replace(/^\//, '')}`;
    return uri;
  };

  return (
    <div className={`markdown-body ${isStreaming ? 'markdown-cursor' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        urlTransform={transformImageUri}
        components={{
          code: CodeBlock as any,
          p: Para,
          a: Anchor,
          img: ({ src, ...props }: any) => <img src={transformImageUri(src || '')} {...props} style={{ maxWidth: '100%', borderRadius: '6px' }} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
