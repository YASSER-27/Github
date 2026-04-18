import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, BrainCircuit, Copy, Eye, CheckCircle2, Download, ChevronDown, Paperclip, X, RefreshCw, Edit3, Zap, BarChart3, Layers, HelpCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Logic, estimateTokens } from '../utils/logic';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const baseUrl = window.location.href.replace(/index\.html.*$/, '');
const clickSound = new Audio(`${baseUrl}sond/click.mp3`);
const notificationSound = new Audio(`${baseUrl}sond/notification.mp3`);
clickSound.volume = 0.15;
notificationSound.volume = 0.5;

const slashCommands = [
  { id: 'translate-en', name: '/translate-en', desc: 'Translate text to English' },
  { id: 'translate-ar', name: '/translate-ar', desc: 'Translate text to Arabic' },
  { id: 'summarize', name: '/summarize', desc: 'Summarize text' },
  { id: 'fix', name: '/fix', desc: 'Fix code issues' },
  { id: 'code-explain', name: '/code-explain', desc: 'Explain code & create README' },
  { id: 'create', name: '/create', desc: 'Export all code as ZIP' },
  { id: 'export-md', name: '/export md', desc: 'Export as Markdown' },
  { id: 'clear', name: '/clear', desc: 'Clear current chat' },
  { id: 'export-jsonl', name: '/export jsonl', desc: 'Export as JSONL' },
  { id: 'export-txt', name: '/export txt', desc: 'Export as TXT' },
];

const MarkdownRenderer = React.memo(({ text }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : '';
          const codeStr = String(children).replace(/\n$/, '');
          if (!inline && lang) {
            return (
              <SyntaxHighlighter
                language={lang}
                style={vscDarkPlus}
                showLineNumbers={false}
                customStyle={{ margin: '0.5em 0', borderRadius: '8px', background: 'rgba(0,0,0,0.3)' }}
                {...props}
              >
                {codeStr}
              </SyntaxHighlighter>
            );
          }
          return (
            <code className="msg-inline-code" {...props}>
              {children}
            </code>
          );
        },
        table({ children, ...props }) {
          return (
            <div className="table-wrapper">
              <table className="msg-table" {...props}>{children}</table>
            </div>
          );
        },
        th({ children, ...props }) {
          return <th className="msg-th" {...props}>{children}</th>;
        },
        td({ children, ...props }) {
          return <td className="msg-td" {...props}>{children}</td>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="msg-link">{children}</a>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
});

const CopyButton = ({ text }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback((e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button onClick={handleCopy} className="msg-action-btn" title="Copy">
      {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const CodeBlock = React.memo(({ code, language, onReview }) => {
  const [copied, setCopied] = React.useState(false);
  const isHtml = ['html', 'xml'].includes((language || '').toLowerCase()) || /<\/?html|<\/?body|<\/?div|<\/?span/.test(code);
  const handleSave = React.useCallback((e) => {
    e.stopPropagation();
    const map = {
      'python': 'py', 'javascript': 'js', 'js': 'js', 'ts': 'ts', 'typescript': 'ts', 'html': 'html', 'css': 'css', 'json': 'json', 'java': 'java', 'c++': 'cpp', 'cpp': 'cpp', 'c': 'c', 'bash': 'sh'
    };
    const ext = map[(language || '').toLowerCase()] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code_snippet.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, language]);
  const handleCopyClick = React.useCallback((e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="code-block-wrapper group" dir="ltr">
      <div className="code-block-header">
        <span className="code-lang">{language || 'Code'}</span>
        <div className="code-actions">
          <button onClick={handleCopyClick} className="code-action-btn">
            {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
            {copied ? 'COPIED' : 'COPY'}
          </button>
          {isHtml && (
            <button onClick={() => onReview({ code, title: (language || 'HTML').toUpperCase() })} className="code-action-btn">
              <Eye size={12} /> REVIEW
            </button>
          )}
          <button onClick={handleSave} className="code-action-btn">
            <Download size={12} /> SAVE
          </button>
        </div>
      </div>
      <SyntaxHighlighter language={language || 'text'} style={vscDarkPlus} showLineNumbers={true} customStyle={{ margin: 0, background: 'transparent', fontSize: '12px', color: 'var(--text-main)', userSelect: 'text' }}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

const MessageRenderer = React.memo(({ text, isStreaming, onReview, enableThinking }) => {
  const rawText = enableThinking ? text : text.replace(/<think>[\s\S]*?<\/thinking>/g, '');
  const { thinking, content } = Logic.parseResponse(rawText);
  const parts = React.useMemo(() => content.split(/(```[\s\S]*?```)/g), [content]);
  return (
    <div className={`message-content ${isStreaming ? 'streaming' : ''}`}>
      {thinking && (
        <div className="thinking-section">
          <div className="thinking-header">
            <BrainCircuit size={12}/>
            <span>Thinking</span>
          </div>
          <div className="thinking-text">{thinking}</div>
        </div>
      )}
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
          if (match) {
            const language = match[1] || 'text';
            const codeContent = match[2].trim();
            return <CodeBlock key={i} language={language} code={codeContent} onReview={onReview} />;
          }
          const codeContent = part.replace(/```/g, '').trim();
          return <CodeBlock key={i} language="text" code={codeContent} onReview={onReview} />;
        }
        return <div key={i} className="message-bubble"><MarkdownRenderer text={part} /></div>;
      })}
    </div>
  );
});

const FallingArrows = React.memo(() => {
  return (
    <div className="falling-arrows-container">
      <span style={{ '--delay': '0s' }}>↓</span>
      <span style={{ '--delay': '0.1s' }}>↓</span>
      <span style={{ '--delay': '0.2s' }}>↓</span>
      <span style={{ '--delay': '0.3s' }}>↓</span>
    </div>
  );
});

const MessageItem = React.memo(({ m, isStreaming, onReview, msgIndex, msgRefs, onRegenerate, onEdit, enableThinking }) => {
  const tokens = estimateTokens(m.text || '');
  const words = (m.text || '').split(/\s+/).filter(w => w.length > 0).length;
  const readTime = Math.max(1, Math.ceil(words / 200));

  return (
    <motion.div
      key={m.id || msgIndex}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`chat__conversation-board__message-container ${m.role === 'user' ? 'reversed' : ''}`}
      ref={el => msgRefs.current[msgIndex] = el}
    >
      <div className="chat__conversation-board__message__context">
        <MessageRenderer text={m.text} isStreaming={isStreaming} onReview={onReview} enableThinking={enableThinking} />
        
        <div className="message-footer">
          <div className="message-stats">
            {m.role !== 'user' && (
              <>
                <span>Context: {tokens}/4096 ({Math.round(tokens / 4096 * 100)}%)</span>
                <span>Output: {tokens}/∞</span>
                <span>{tokens} token{tokens !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
          <div className="message-actions">
            <CopyButton text={m.text} />
            {m.role === 'bot' && onRegenerate && (
              <button onClick={onRegenerate} className="msg-action-btn" title="Regenerate">
                <RefreshCw size={12} /> Regenerate
              </button>
            )}
            {m.role === 'user' && onEdit && (
              <button onClick={() => onEdit(m.text)} className="msg-action-btn" title="Edit prompt">
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>
        </div>

        {m.attachments && m.attachments.length > 0 && (
          <div className="attachment-thumbnails">
            {m.attachments.map((a, idx) => (
              <div key={idx} className="attachment-thumb">
                <span className="attachment-icon">{a.type?.includes('pdf') ? '📄' : a.type?.includes('text') || a.name?.endsWith('.md') || a.name?.endsWith('.txt') ? '📝' : '📎'}</span>
                <span className="attachment-name">{a.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

const MessageList = React.memo(({ messages, isTyping, onReview, endRef, scrollToBottom, isAutoScroll, onRegenerate, onEdit, enableThinking }) => {
  const msgRefs = React.useRef([]);

  return (
    <>
      {messages.length === 0 && !isTyping ? (
        <div className="welcome-screen">
          <h1 className="welcome-title">Hello there,</h1>
          <h1 className="welcome-title subtitle">How can I help you?</h1>
        </div>
      ) : null}
      {messages.length === 0 && isTyping ? (
        <div className="skeleton-loading">
          <div className="skeleton-wrapper px-10 w-full max-w-2xl mx-auto">
            <div className="skeleton-line title-line w-60"></div>
            <div className="skeleton-line w-100"></div>
            <div className="skeleton-line w-100"></div>
            <div className="skeleton-line w-80"></div>
            <br/>
            <div className="skeleton-line w-100"></div>
            <div className="skeleton-line w-100"></div>
            <div className="skeleton-line w-40"></div>
          </div>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {messages.map((m, i) => (
          <MessageItem
            key={m.id || i}
            m={m}
            isStreaming={isTyping && i === messages.length - 1 && m.role === 'bot'}
            onReview={onReview}
            msgIndex={i}
            msgRefs={msgRefs}
            onRegenerate={i === messages.length - 1 && m.role === 'bot' && !isTyping ? onRegenerate : null}
            onEdit={m.role === 'user' ? onEdit : null}
            enableThinking={enableThinking}
          />
        ))}
      </AnimatePresence>
      {isTyping && messages.length > 0 && (
        <div className="chat__conversation-board__message-container">
          <div className="chat__conversation-board__message__context">
            <FallingArrows />
          </div>
        </div>
      )}
      <div ref={endRef}/>
      {!isAutoScroll && messages.length > 0 && (
        <button onClick={scrollToBottom} className="scroll-to-bottom-btn" title="Go to latest message">
          <ChevronDown size={18} />
        </button>
      )}
    </>
  );
});

const ChatWindow = ({ messages, isTyping, input, setInput, handleSend, abortRef, status, endRef, externalApiUrl, setMessages, setChatHistory, currentChatId, modelName, setIsTyping, soundClick, soundNotification, enableThinking, systemPrompt, promptTemplates }) => {
  const [attachments, setAttachments] = React.useState([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = React.useState(0);
  const [ghostText, setGhostText] = React.useState('');
  const [isAutoScroll, setIsAutoScroll] = React.useState(true);
  const [htmlPreview, setHtmlPreview] = React.useState(null);
  const [genStats, setGenStats] = React.useState(null);
  const [editMode, setEditMode] = React.useState(null);
  const [editText, setEditText] = React.useState('');
  const containerRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const prevInputRef = React.useRef('');
  const notificationPlayedRef = React.useRef(false);
  const genStartRef = React.useRef(0);
  const genTokensRef = React.useRef(0);
  const fileInputRef = React.useRef(null);

  const handleDrop = React.useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    const mapped = files.map(f => ({ name: f.name, size: f.size, type: f.type, file: f }));
    setAttachments(prev => [...prev, ...mapped]);
  }, []);

  const handleFileSelect = React.useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const mapped = files.map(f => ({ name: f.name, size: f.size, type: f.type, file: f }));
    setAttachments(prev => [...prev, ...mapped]);
    e.target.value = '';
  }, []);

  const handleRemoveAttachment = React.useCallback((idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }, []);
  const handleDragOver = React.useCallback((e) => e.preventDefault(), []);

  const handleOpenHtml = React.useCallback((payload) => {
    setHtmlPreview(payload);
  }, []);

  const filteredCommands = React.useMemo(() => {
    if (!input.startsWith('/')) return [];
    const q = input.slice(1).toLowerCase();
    return slashCommands.filter(c => c.name.slice(1).includes(q) || c.desc.toLowerCase().includes(q));
  }, [input]);

  // Handle slash commands
  const handleSlashCommand = React.useCallback(async (cmd, text) => {
    switch (cmd) {
      case 'clear': setInput(''); return false;
      case 'export-jsonl': {
        if (messages.length === 0) return false;
        const jsonl = messages.map(m => JSON.stringify({ role: m.role, content: m.text })).join('\n');
        const blob = new Blob([jsonl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `chat_${Date.now()}.jsonl`; a.click();
        URL.revokeObjectURL(url);
        setInput('');
        return false;
      }
      case 'export-md': {
        if (messages.length === 0) return false;
        const md = messages.map(m => `### ${m.role === 'user' ? 'You' : 'AI'}\n\n${m.text}`).join('\n\n---\n\n');
        const blob = new Blob([`# Conversation\n\n${md}`, { type: 'text/markdown' }]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `chat_${Date.now()}.md`; a.click();
        URL.revokeObjectURL(url);
        setInput('');
        return false;
      }
      case 'export-txt': {
        if (messages.length === 0) return false;
        const txt = messages.map(m => `--- ${m.role.toUpperCase()} ---\n${m.text}\n`).join('\n');
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `chat_${Date.now()}.txt`; a.click();
        URL.revokeObjectURL(url);
        setInput('');
        return false;
      }
      case 'create': {
        const zip = new JSZip();
        const codeFolder = zip.folder('code');
        let codeIndex = 0;
        for (const msg of messages) {
          if (!msg.text) continue;
          const codeBlocks = msg.text.match(/```(\w+)?\n([\s\S]*?)```/g) || [];
          for (const block of codeBlocks) {
            const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
            if (match) {
              const lang = match[1] || 'txt';
              const code = match[2].trim();
              const extMap = { python: 'py', javascript: 'js', typescript: 'ts', html: 'html', css: 'css', json: 'json', bash: 'sh', markdown: 'md' };
              const ext = extMap[lang.toLowerCase()] || 'txt';
              codeFolder.file(`code_${++codeIndex}.${ext}`, code);
            }
          }
        }
        if (codeIndex === 0) { alert('No code blocks found in chat'); return false; }
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, `code_export_${Date.now()}.zip`);
        setInput('');
        return false;
      }
      default: return true; // needs model response
    }
  }, [messages, setInput]);

  React.useEffect(() => {
    setShowSuggestions(input.startsWith('/') && filteredCommands.length > 0);
    setSelectedSuggestion(0);
    setGhostText(filteredCommands[0] ? filteredCommands[0].name : '');
  }, [input, filteredCommands]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      setIsAutoScroll(nearBottom);
    };
    container.addEventListener('scroll', onScroll);
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    endRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setIsAutoScroll(true);
  }, [endRef]);

  React.useEffect(() => {
    if (isAutoScroll) {
      endRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, isTyping, isAutoScroll, endRef]);

  React.useEffect(() => {
    const handler = (e) => {
      if (!showSuggestions) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion(s => Math.min(s + 1, filteredCommands.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion(s => Math.max(0, s - 1)); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSuggestions, filteredCommands, selectedSuggestion]);

  React.useEffect(() => {
    const h = (e) => { const t = e.detail; if (t) {
      const evt = new CustomEvent('doExport', { detail: t }); window.dispatchEvent(evt);
    }};
    window.addEventListener('exportConversation', h);
    return () => window.removeEventListener('exportConversation', h);
  }, []);

  React.useEffect(() => {
    if (soundClick && input.length > prevInputRef.current.length) {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    }
    prevInputRef.current = input;
  }, [input, soundClick]);

  React.useEffect(() => {
    if (soundNotification && !isTyping && messages.length > 0 && !notificationPlayedRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'bot' && lastMsg.text && lastMsg.text.length > 10) {
        notificationPlayedRef.current = true;
        notificationSound.currentTime = 0;
        notificationSound.play().catch(() => {});
      }
    }
    if (isTyping) {
      notificationPlayedRef.current = false;
    }
  }, [isTyping, messages, soundNotification]);

  const adjustTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(300, textarea.scrollHeight) + 'px';
  }, []);

  React.useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleEditPrompt = React.useCallback((text) => {
    setEditMode(messages.length - 1);
    setEditText(text);
  }, [messages.length]);

  const handleEditSubmit = React.useCallback(() => {
    if (!editText.trim()) return;
    const newText = editText.trim();
    setEditMode(null);
    setInput(newText);
    setMessages(prev => prev.slice(0, editMode));
    if (setChatHistory && currentChatId) {
      setChatHistory(prev => prev.map(c => c.id === currentChatId ? { ...c, msgs: prev.slice(0, editMode) } : c));
    }
  }, [editText, editMode, setMessages, setChatHistory, currentChatId, setInput]);

  const handleRegenerate = React.useCallback(async () => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    
    setMessages(prev => prev.slice(0, -1));
    setIsTyping(true);
    genStartRef.current = Date.now();
    genTokensRef.current = 0;
    
    try {
      const prompt = Logic.getFormattedPrompt(messages.slice(-6), modelName || '');
      const apiUrl = (externalApiUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/completion`, {
        method: 'POST',
        signal: (abortRef.current = new AbortController()).signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: true, ...Logic.defaultParams, stop: Logic.stopTokens })
      });

      const reader = res.body.getReader();
      let botText = "";
      const botMsgId = `msg-${Date.now()}-bot-regen`;
      setMessages(prev => [...prev, { role: 'bot', text: "", id: botMsgId }]);

      let lastUpdate = Date.now();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of chunk) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.content) {
              botText += data.content;
              genTokensRef.current++;
              const now = Date.now();
              if (now - lastUpdate >= 120) {
                lastUpdate = now;
                setMessages(prev => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'bot') {
                    next[next.length - 1] = { ...last, text: botText };
                  }
                  return next;
                });
              }
            }
          } catch (e) {}
        }
      }
      
      const elapsed = (Date.now() - genStartRef.current) / 1000;
      setGenStats({ tokens: genTokensRef.current, time: elapsed, speed: (genTokensRef.current / elapsed).toFixed(1) });
      
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'bot') {
          next[next.length - 1] = { ...last, text: botText };
        }
        return next;
      });
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Regenerate error:', e);
    } finally {
      setIsTyping(false);
    }
  }, [messages, externalApiUrl, modelName]);

  const inputTokens = estimateTokens(input);
  const inputLength = input.length;
  const maxChars = 1000000;

  return (
    <div className="chat-window">
      <div className="chat__conversation-board" ref={containerRef}>
        <MessageList messages={messages} isTyping={isTyping} onReview={handleOpenHtml} endRef={endRef} scrollToBottom={scrollToBottom} isAutoScroll={isAutoScroll} onRegenerate={handleRegenerate} onEdit={handleEditPrompt} enableThinking={enableThinking} />
      </div>

      {genStats && !isTyping && (
        <div className="gen-stats-bar">
          <BarChart3 size={12} />
          <span>{genStats.tokens} tokens</span>
          <span>{genStats.time.toFixed(1)}s</span>
          <span>{genStats.speed} t/s</span>
          <button onClick={() => setGenStats(null)} className="gen-stats-close"><X size={10}/></button>
        </div>
      )}

      {htmlPreview && (
        <div className="html-preview-overlay">
          <div className="html-preview-container">
            <div className="html-preview-header">
              <div>
                <div className="preview-label">HTML Preview</div>
                <div className="preview-title">{htmlPreview.title || 'HTML'}</div>
              </div>
              <button onClick={() => setHtmlPreview(null)} className="close-preview-btn">Close</button>
            </div>
            <iframe title="HTML Preview" sandbox="allow-scripts allow-same-origin" srcDoc={htmlPreview.code} className="html-preview-iframe" />
          </div>
        </div>
      )}

      <div className="chat__conversation-panel">
        <div className="chat__conversation-panel__container">
          <div className="chat-input-wrapper">
            {/* Slash command help */}
            {showSuggestions && filteredCommands.length > 0 && (
              <div className="slash-help">
                <div className="slash-help-header"><HelpCircle size={10} /> Commands</div>
                {filteredCommands.map((cmd, i) => (
                  <div key={cmd.id} className={`slash-help-item ${i === selectedSuggestion ? 'slash-selected' : ''}`}
                    onClick={() => { setInput(cmd.name + ' '); setShowSuggestions(false); }}
                    onMouseEnter={() => setSelectedSuggestion(i)}>
                    <span className="slash-cmd-name">{cmd.name}</span>
                    <span className="slash-cmd-desc">{cmd.desc}</span>
                  </div>
                ))}
              </div>
            )}
            
            {attachments.length > 0 && (
              <div className="input-attachments">
                {attachments.map((a, idx) => (
                  <div key={idx} className="input-attachment-thumb">
                    <span className="input-attachment-icon">{a.type?.includes('pdf') ? '📄' : '📎'}</span>
                    <span className="input-attachment-name">{a.name}</span>
                    <button onClick={() => handleRemoveAttachment(idx)} className="input-attachment-remove"><X size={10}/></button>
                  </div>
                ))}
              </div>
            )}
            
            {ghostText && !input && <div className="ghost-text">{ghostText}</div>}
            <div className="input-row">
              <button onClick={() => fileInputRef.current?.click()} className="attach-btn" title="Attach files">
                <Paperclip size={16} />
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.md,.py,.js,.jsx,.ts,.tsx,.html,.css,.json,.xml,.yaml,.yml,.csv,.log,.sh,.bat,.c,.cpp,.java,.rb,.go,.rs,.php,.sql,.R,.m,.swift,.kt,.scala,.lua,.pl,.pm,.tcl,.asm,.diff,.patch,.tex,.bib,.rst,.man,.roff,.groff,.text,.texi,.info,.doc,.docx,.rtf,.wri,.wpd,.wp,.sdw,.sxw,.uot,.fodt,.abw,.zabw,.gnumeric,.xls,.xlsx,.ods,.fods,.ppt,.pptx,.odp,.fodp,.key,.zip,.tar,.gz,.bz2,.xz,.7z,.rar,.jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.ico,.tiff,.tif,.heic,.heif,.avif,.mp3,.wav,.ogg,.flac,.aac,.wma,.m4a,.mp4,.avi,.mov,.wmv,.flv,.mkv,.webm,.m4v,.iso,.exe,.dmg,.apk,.deb,.rpm,.msi,.app,.jar,.class,.pyc,.pyo,.so,.dll,.dylib,.a,.lib,.o,.obj,.pdb,.ilk,.exp,.map,.inf,.sys,.drv,.cat,.cab,.cab,.msi,.msp,.mst,.msu,.appx,.appxbundle,.msix,.msixbundle" onChange={handleFileSelect} className="file-input-hidden" />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(300, e.target.scrollHeight) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !input.startsWith('/')) {
                    e.preventDefault();
                    handleSend(attachments);
                    setAttachments([]);
                  } else if (e.key === 'Enter' && !e.shiftKey && input.startsWith('/')) {
                    e.preventDefault();
                    const cmd = input.trim().split(' ')[0].toLowerCase().replace('/', '');
                    const needsModel = handleSlashCommand(cmd, input);
                    if (needsModel) {
                      handleSend(attachments);
                      setAttachments([]);
                    }
                  }
                }}
                placeholder={status === 'READY' ? "/commands" : "Please load a model..."}
                className="chat-input-textarea"
                disabled={status !== 'READY'}
              />
              <div className="input-actions">
                <div className="char-count">
                  <span>{inputTokens}</span> tok · <span>{inputLength}</span> / 1M
                </div>
                {isTyping ? (
                  <button onClick={() => abortRef.current?.abort()} className="stop-button" title="Stop generation">
                    <Square size={16} />
                  </button>
                ) : (
                  <button onClick={() => { handleSend(attachments); setAttachments([]); }} disabled={status !== 'READY'} className="send-message-button" title="Send">
                    <svg viewBox="0 0 512 512" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="48" d="M112 244l144-144l144 144M256 120v292"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
