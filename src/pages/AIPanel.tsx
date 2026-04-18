import { useRef, useEffect, useState, useCallback } from 'react';
import { Square, Send, AlertCircle, Trash2, Play, Copy, ChevronRight, CheckSquare, Loader, Download, Upload } from 'lucide-react';
import { useAI } from '../context/AIContext';
import Markdown from '../components/Markdown';
import './AIPanel.css';

export default function AIPanel() {
  const {
    messages, setMessages, input, setInput, isStreaming, error,
    sendMessage, stopGeneration, clearChat
  } = useAI();

  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [planMode, setPlanMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Check server status on mount & periodically
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('http://localhost:8080/v1/models');
        setIsRunning(r.ok);
      } catch { setIsRunning(false); }
    };
    check();
    const t = setInterval(check, 6000);
    return () => clearInterval(t);
  }, []);

  // Smart auto-scroll
  useEffect(() => {
    if (autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, autoScroll]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setPlanMode(val.trimStart().startsWith('/plan'));
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const doSend = useCallback(() => {
    sendMessage();
    // Reset textarea height and refocus
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
      setPlanMode(false);
    }, 50);
  }, [sendMessage]);

  const handleStart = async () => {
    setIsStarting(true);
    const res = await (window as any).api?.startAI('');
    if (res?.success) setIsRunning(true);
    setIsStarting(false);
  };

  const handleExportChat = () => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitbot-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          clearChat();
          setTimeout(() => {
            setMessages(json);
          }, 50);
        }
      } catch (err) {
        alert('Invalid chat file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="ai-panel fade-in">
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportChat} />
      {/* Topbar */}
      <div className="ai-topbar">
        <div className="ai-topbar-left">
          <div className={`ai-status-dot ${isRunning ? 'running' : ''}`} />
          <span className="ai-model-label">{isRunning ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="ai-controls">
          {!isRunning ? (
            <button className="button button-primary" onClick={handleStart} disabled={isStarting} style={{ fontSize: '13px' }}>
              {isStarting ? <span className="spinner" /> : <Play size={14} />}
              {isStarting ? 'Starting…' : 'Start Engine'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button" onClick={handleExportChat} title="Export Chat" style={{ fontSize: '11px', padding: '4px 8px' }}>
                <Download size={13} /> Export
              </button>
              <button className="button" onClick={() => fileInputRef.current?.click()} title="Import Chat" style={{ fontSize: '11px', padding: '4px 8px' }}>
                <Upload size={13} /> Import
              </button>
              <button className="button button-danger" onClick={clearChat} style={{ fontSize: '11px', padding: '4px 8px' }}>
                <Trash2 size={13} />
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="ai-error-banner">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* /plan mode indicator */}
      {planMode && (
        <div className="ai-plan-banner">
          <ChevronRight size={14} />
          <strong>/plan mode</strong> — Describe the project and I'll create all files automatically in a new repository.
        </div>
      )}

      {/* Messages */}
      <div className="ai-messages" ref={scrollContainerRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="ai-empty">
            <div className="ai-circles-demo">
              <div className="ai-circle-multiple">
                <div className="ai-circle"></div>
                <div className="ai-circle"></div>
                <div className="ai-circle"></div>
              </div>
            </div>
            <h3>Gitbot AI Copilot</h3>
            <p>Ask me anything about code, or use <code>/plan</code> to scaffold an entire project automatically.</p>
            <div className="ai-hints">
              <span onClick={() => setInput('/plan a todo app in React')}>/plan a React todo app</span>
              <span onClick={() => setInput('Explain how promises work in JavaScript')}>Explain promises</span>
              <span onClick={() => setInput('Write a Python script to parse CSV files')}>Parse CSV in Python</span>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <AIMessage
              key={i}
              role={m.role}
              content={m.content}
              isStreaming={i === messages.length - 1 && m.role === 'assistant' && isStreaming}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`ai-input-bar ${planMode ? 'plan-mode' : ''}`}>
        <div className="ai-input-row">
          <textarea
            ref={textareaRef}
            className="ai-textarea"
            placeholder={isRunning
              ? (planMode ? 'Describe your project… (Enter to send)' : 'Message Copilot… (Enter to send, Shift+Enter for newline)')
              : 'Start the engine to begin chatting'}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isRunning}
            rows={1}
            autoComplete="off"
          />
          {isStreaming ? (
            <button className="ai-stop-btn" onClick={stopGeneration} title="Stop">
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button className="ai-send-btn" onClick={doSend}
              disabled={!isRunning || !input.trim()} title="Send (Enter)">
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="ai-hint">
          Shift+Enter for new line &nbsp;·&nbsp; /plan to scaffold a project
        </div>
      </div>
    </div>
  );
}

// ── Individual message component ──────────────────────────────────────────────
function AIMessage({ role, content, isStreaming }: {
  role: string; content: string; isStreaming: boolean;
}) {
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const handleCopy = () => navigator.clipboard.writeText(content);

  // Detect if generating a plan
  const isPlan = role === 'assistant' && typeof content === 'string' && content.trimStart().startsWith('{') && content.includes('"files"');
  
  let renderContent = <Markdown content={content} isStreaming={isStreaming} />;

  if (isPlan) {
    const isFinished = content.trimEnd().endsWith('}') || !isStreaming;
    const parsedFiles: { path: string; content: string }[] = [];
    
    // Robust extraction instead of JSON.parse
    const _parts = content.split(/"path"\s*:\s*"/).slice(1);
    for (const part of _parts) {
      const pMatch = part.match(/^([^"]+)"\s*(?:,\s*"content"\s*:\s*")?/);
      if (pMatch) {
        const pathName = pMatch[1];
        let contentPart = '';
        if (part.includes('"content"')) {
          const contentStart = part.indexOf('"content":') + 10;
          const quoteStart = part.indexOf('"', contentStart);
          if (quoteStart !== -1) {
            contentPart = part.substring(quoteStart + 1);
            const endIdx = contentPart.lastIndexOf('"}');
            if (endIdx !== -1) contentPart = contentPart.substring(0, endIdx);
            else if (contentPart.endsWith('"')) contentPart = contentPart.substring(0, contentPart.length - 1);
            contentPart = contentPart.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
        }
        parsedFiles.push({ path: pathName, content: contentPart });
      }
    }

    renderContent = (
      <ul className="fa-ul" style={{ listStyleType: 'none', paddingLeft: 0, margin: '16px 0' }}>
        {parsedFiles.map((file, idx) => {
          const isCurrent = idx === parsedFiles.length - 1 && !isFinished;
          const isExpanded = !!expandedFiles[file.path];
          
          return (
            <li key={idx} style={{ marginBottom: '8px' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isCurrent ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background 0.2s' }}
                onClick={() => setExpandedFiles(p => ({ ...p, [file.path]: !p[file.path] }))}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {isCurrent ? (
                  <Loader size={16} className="fa-spin" />
                ) : (
                  <CheckSquare size={16} color="var(--green)" />
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', flex: 1 }}>{file.path}</span>
                <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />
              </div>
              
              {isExpanded && (
                <div style={{ marginLeft: '26px', marginTop: '8px', padding: '12px', background: 'var(--bg-color)', borderRadius: '6px', border: '1px solid var(--border-color)', position: 'relative', overflowX: 'hidden' }}>
                  <Markdown content={`\`\`\`\n${file.content}\n\`\`\``} isStreaming={isCurrent} />
                </div>
              )}
            </li>
          );
        })}
        {isStreaming && parsedFiles.length === 0 && (
          <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
            <Loader size={16} className="fa-spin" />
            <span style={{ fontSize: '13px' }}>Scaffolding project structure...</span>
          </li>
        )}
      </ul>
    );

    // If there is a status message appended at the end (like Repository created or Failed), render it!
    const statusMatch = content.match(/\n\n---\n\*\*.*$/)?.[0];
    if (statusMatch) {
      renderContent = (
        <>
          {renderContent}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <Markdown content={statusMatch} isStreaming={false} />
          </div>
        </>
      );
    }
  }

  return (
    <div className={`ai-msg ${role}`}>
      <div className="ai-msg-body">
        <div className="ai-msg-role">{role === 'user' ? 'You' : 'Gitbot AI'}</div>
        <div className="ai-msg-text">
          {renderContent}
          {isStreaming && !isPlan && (
            <div className="ai-thinking-spinner" style={{ marginTop: '8px' }}>
              <div className="ai-notch" />
              <span style={{ fontSize: '12px' }}>Generating…</span>
            </div>
          )}
        </div>
        {role === 'assistant' && content && !isStreaming && !isPlan && (
          <div className="ai-msg-actions">
            <button className="ai-action-btn" onClick={handleCopy} title="Copy response">
              <Copy size={13} /> Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
