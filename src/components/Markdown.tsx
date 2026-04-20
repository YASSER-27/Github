import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { createHighlighter, type HighlighterCore, bundledLanguages, bundledThemes } from 'shiki';
import { Check, Copy, ExternalLink, Download, Presentation, ChevronDown, ChevronRight } from 'lucide-react';
import mermaid from 'mermaid';
import './Markdown.css';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

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

const Mermaid = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const wasAtBottom = useRef(true);

  // Capture scroll position before state updates
  const captureScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    lastScrollTop.current = scrollTop;
    // Check if within 40px of bottom
    wasAtBottom.current = (scrollHeight - scrollTop - clientHeight) < 40;
  };

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    
    if (wasAtBottom.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    } else {
      containerRef.current.scrollTop = lastScrollTop.current;
    }
  }, [svg]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!code || code.length < 10) return;
      
      const quoteCount = (code.match(/"/g) || []).length;
      const bracketCount = (code.match(/\[/g) || []).length;
      const bracketCloseCount = (code.match(/\]/g) || []).length;
      
      if (quoteCount % 2 !== 0 || bracketCount !== bracketCloseCount) return;

      try {
        setIsRendering(true);
        const { svg: renderedSvg } = await mermaid.render(id.current, code.trim());
        
        captureScroll();
        setSvg(renderedSvg);
        setError(null);
      } catch (err: any) {
        if (code.includes('\n') && code.trim().split('\n').length > 2) {
          console.error('Mermaid Error:', err);
          if (!svg) setError('Failed to render diagram. Check Mermaid syntax.');
        }
        const el = document.getElementById(id.current);
        if (el) el.remove();
      } finally {
        setIsRendering(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [code]);

  if (error) return <div className="mermaid-error">{error}</div>;
  if (!svg && isRendering) return <div className="mermaid-loading">Rendering diagram...</div>;

  return (
    <div 
      className={`mermaid-container ${isRendering ? 'rendering' : ''}`}
      ref={containerRef}
      onScroll={captureScroll}
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

// Simple hash function for persistence keys
function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : 'text';
  const code = String(children).replace(/\n$/, '');
  const [html, setHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const blockHash = hashString(code);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem(`cb_collapsed_${blockHash}`) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(`cb_collapsed_${blockHash}`, isMinimized.toString());
  }, [isMinimized, blockHash]);

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

  if (lang === 'mermaid') {
    return (
      <div className={`code-block-wrapper diagram-wrapper ${isMinimized ? 'minimized' : ''}`}>
        <div className="code-header">
          <div className="code-header-left" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span className="code-lang-badge diagram">
              <Presentation size={12} /> diagram
            </span>
          </div>
          <div className="code-header-actions">
            {!isMinimized && (
              <button
                className="code-action-btn"
                onClick={() => {
                  const svgEl = document.querySelector('.mermaid-container svg');
                  if (svgEl) {
                    const svgData = new XMLSerializer().serializeToString(svgEl);
                    const blob = new Blob([svgData], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'diagram.svg';
                    a.click(); URL.revokeObjectURL(url);
                  }
                }}
              >
                <Download size={13} /> Save SVG
              </button>
            )}
            <button onClick={handleCopy} className="code-action-btn">
              {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        {!isMinimized && (
          <div className="diagram-content">
            <Mermaid code={code} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`code-block-wrapper ${isMinimized ? 'minimized' : ''}`}>
      <div className="code-header">
        <div className="code-header-left" onClick={() => setIsMinimized(!isMinimized)}>
          {isMinimized ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span className="code-lang-badge">{lang}</span>
        </div>
        <div className="code-header-actions">
          {!isMinimized && (
            <>
              {canOpen && (
                <button onClick={handleOpen} className="code-action-btn" title="Open in browser">
                  <ExternalLink size={13} /> Open
                </button>
              )}
              <button onClick={handleSave} className="code-action-btn" title="Save file">
                {saved ? <Check size={13} color="var(--green)" /> : <Download size={13} />}
                {saved ? 'Saved' : 'Save'}
              </button>
            </>
          )}
          <button onClick={handleCopy} className="code-action-btn" title="Copy code">
            {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      {!isMinimized && (
        <>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} className="shiki-code" />
          ) : (
            <pre className="code-fallback"><code>{children}</code></pre>
          )}
        </>
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
    if (uri.startsWith('http') || uri.startsWith('data:') || uri.startsWith('gitbot-repo:')) return uri;
    if (repoName) return `gitbot-repo://local/${encodeURIComponent(repoName)}/${uri.replace(/^\//, '')}`;
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
