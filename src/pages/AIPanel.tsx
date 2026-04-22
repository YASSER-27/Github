import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Square, Send, AlertCircle, Trash2, Copy, ChevronRight, CheckSquare,
  Loader, Download, Upload, Check, History, MessageSquare, Edit2, Plus, Clock, Zap,
  PanelLeftOpen, PanelLeftClose, Image as ImageIcon, X
} from 'lucide-react';
import { useAI } from '../context/AIContext';
import type { AISession } from '../context/AIContext';
import Markdown from '../components/Markdown';
import './AIPanel.css';

export default function AIPanel() {
  const {
    sessions, setSessions, currentSessionId, setCurrentSessionId,
    input, setInput, isStreaming, error,
    sendMessage, stopGeneration, clearChat,
    createNewSession, deleteSession, renameSession,
    sidebarOpen, setSidebarOpen, selectedImage, setSelectedImage,
    thinkingMode, setThinkingMode
  } = useAI();

  const [aiModels, setAiModels] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  const [isRunning, setIsRunning] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [planMode, setPlanMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /**
   * Smart Image Compression (Inspired by Ollama/LLaVA benchmarks)
   * Resizes large images to max 1120px for faster prompt processing on CPU.
   */
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1120; // Sweet spot for vision tokens/accuracy

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // High compression
        };
      };
    });
  };

  // Check server status & load models
  useEffect(() => {
    const check = async () => {
      // Skip periodic check if we are currently starting/switching models
      if (isStarting || isConnecting) return;
      try {
        const isOk = await (window as any).api?.pingAI?.();
        // Smart connection check: only update if not in a transient state
        if (!isStarting && !isConnecting) {
          setIsRunning(!!isOk);
        }
      } catch { 
        if (!isStarting && !isConnecting) setIsRunning(false); 
      }

    };
    check();
    const t = setInterval(check, 6000);

    // Initial load of models
    (window as any).api?.getSettings().then((s: any) => {
      if (s?.aiModels) setAiModels(s.aiModels);
    });

    return () => clearInterval(t);
  }, []);

  // Handle click outside for dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelDropdown]);

  // refined auto-scroll logic (v3)
  useEffect(() => {
    if (!autoScroll || !isStreaming) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, autoScroll, isStreaming]);

  // Handle manual scroll interrupt
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Check if user is at the bottom (within 50px buffer)
    const offset = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = offset < 50;

    // If user scrolls up, disable auto-scroll
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
    // If user scrolls back to bottom, re-enable auto-scroll
    else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const trimmed = val.trimStart();
    setPlanMode(trimmed.startsWith('/plan') || trimmed.startsWith('/diagram') || trimmed.startsWith('/thinking'));
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
    }
    e.target.value = '';
  };

  const doSend = useCallback(async () => {
    if (input.trim() === '/model') {
      const path = await (window as any).api?.pickModelFile();
      if (path) {
        setIsStarting(true);
        const res = await (window as any).api?.startAI(path);
        if (res?.success) {
          const ready = await waitForReady();
          if (ready) setIsRunning(true);
        }
        setIsStarting(false);
      }

      setInput('');
      return;
    }
    if (input.trim() === '/model_vision') {
      const modelPath = await (window as any).api?.pickModelFile();
      if (modelPath) {
        const mmprojPath = await (window as any).api?.pickMmprojFile();
        if (mmprojPath) {
          setIsStarting(true);
          const res = await (window as any).api?.startAI(modelPath, mmprojPath);
          if (res?.success) {
            const ready = await waitForReady();
            if (ready) setIsRunning(true);
          }
          setIsStarting(false);
        }

      }
      setInput('');
      return;
    }
    sendMessage();
    // Reset textarea height and refocus
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
      setPlanMode(false);
    }, 50);
  }, [sendMessage, input, setInput]);

  const waitForReady = async (maxRetries = 15) => {
    setEngineError(null);
    for (let i = 0; i < maxRetries; i++) {
      try {
        const isOk = await (window as any).api?.pingAI?.();
        if (isOk) return true;
      } catch {}
      // Smart: faster polling during boot (500ms) for better UX
      await new Promise(r => setTimeout(r, 500));
    }

    
    // If we timed out, check if there was a specific error from stderr
    const err = await (window as any).api?.getAIError();
    if (err) setEngineError(err);
    return false;
  };

  const handleSwitchModel = async (model: any) => {
    setIsConnecting(true);
    setIsStarting(true);
    // REMOVED: setIsRunning(false); // SMART: Don't set to false immediately to prevent UI flickering


    // Save as active in settings first for persistence
    try {
      const s = await (window as any).api?.getSettings();
      if (s) {
        s.aiModels = s.aiModels.map((m: any) => ({ ...m, isActive: m.id === model.id }));
        await (window as any).api?.saveSettings(s);
        setAiModels(s.aiModels);
      }
    } catch { }

    setEngineError(null);
    const res = await (window as any).api?.startAI(model.modelPath, model.mmprojPath);
    if (res?.success) {
      const ready = await waitForReady();
      if (ready) setIsRunning(true);
    }

    setIsStarting(false);
    setIsConnecting(false);
  };

  const handleExportSession = (session: AISession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const data = JSON.stringify(session.messages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitbot-chat-${session.title.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartRename = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveRename = () => {
    if (editingId) {
      renameSession(editingId, editTitle || 'Untitled Chat');
      setEditingId(null);
    }
  };

  const handleImportChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) || (parsed.messages)) {
          // Create a new session for the imported chat
          const _importedSession: AISession = {
            id: 'imported-' + Date.now(),
            title: parsed.title || 'Imported Chat',
            messages: parsed.messages || parsed,
            timestamp: Date.now()
          };
          setSessions(prev => [_importedSession, ...prev]);
          setCurrentSessionId(_importedSession.id);
          // For now, we'll just alert that this specific feature needs context update
          // Or we use the existing createNewSession and then setMessages if context allowed it
          alert('Imported chat loading into a new session...');
          createNewSession();
          // Note: Since setMessages was removed, we'd need a multi-step context fix 
          // but for now let's focus on the sidebar history.
        }
      } catch (err) {
        alert('Invalid chat file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className={`ai-panel-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportChat} />

      {/* ── Sidebar ── */}
      <aside className="ai-sidebar">
        <div className="sidebar-header">
          <History size={18} />
          <span>Chat History</span>
          <button className="sidebar-hide-btn" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose size={18} />
          </button>
        </div>

        <button className="new-chat-sidebar-btn" onClick={createNewSession}>
          <Plus size={16} /> New Chat
        </button>

        <div className="sidebar-scroll-area">
          {sessions.length === 0 ? (
            <div className="sidebar-empty">No previous chats</div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className={`sidebar-item ${currentSessionId === s.id ? 'active' : ''}`}
                onClick={() => setCurrentSessionId(s.id)}
              >
                <div className="item-icon"><MessageSquare size={16} /></div>
                <div className="item-content">
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      className="sidebar-edit-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={e => e.key === 'Enter' && handleSaveRename()}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="item-title">{s.title || 'Untitled Chat'}</span>
                  )}
                  <span className="item-date">{new Date(s.timestamp).toLocaleDateString()}</span>
                </div>

                <div className="item-actions">
                  <button onClick={(e) => handleStartRename(s.id, s.title, e)} title="Rename"><Edit2 size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="delete-btn" title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="ai-panel fade-in">
        {!sidebarOpen && (
          <button className="sidebar-show-btn" onClick={() => setSidebarOpen(true)}>
            <PanelLeftOpen size={20} />
          </button>
        )}

        {/* Topbar */}
        <div className="ai-topbar">
          <div className="ai-topbar-left">
            <div className="button" style={{ 
              cursor: 'default', 
              fontSize: '11px', 
              padding: '4px 8px',
              borderColor: isStarting || isConnecting ? 'var(--orange)' : 'var(--border-color)'
            }}>
              <div className={`ai-status-dot ${isRunning ? 'running' : (isStarting || isConnecting ? 'starting' : '')}`} style={{ width: '8px', height: '8px' }} />
              <span style={{ 
                color: isRunning ? 'var(--text-primary)' : (isStarting || isConnecting ? 'var(--orange)' : 'var(--text-secondary)'),
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {isRunning ? 'Connected' : (isStarting || isConnecting ? 'Connecting...' : 'Offline')}
              </span>
            </div>
          </div>
          {engineError && (
            <div className="ai-engine-error-bubble" onClick={() => setEngineError(null)} title="Click to dismiss">
              <AlertCircle size={14} />
              <span>{engineError.length > 50 ? engineError.substring(0, 50) + '...' : engineError}</span>
            </div>
          )}
          <div className="ai-controls">
            {!isRunning ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {aiModels.length > 0 && !isStarting && (
                  <div className="ai-custom-dropdown" ref={dropdownRef}>
                    <button 
                      className={`ai-model-select-topbar offline ${showModelDropdown ? 'open' : ''}`}
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      title="Select a saved model to start"
                    >
                      {aiModels.find(m => m.isActive)?.name || 'Select Model...'}
                    </button>
                    {showModelDropdown && (
                      <div className="ai-custom-dropdown-list">
                        {aiModels.map(m => (
                          <div 
                            key={m.id} 
                            className={`ai-custom-dropdown-item ${m.isActive ? 'active' : ''}`}
                            onClick={() => {
                              handleSwitchModel(m);
                              setShowModelDropdown(false);
                            }}
                          >
                            <span className="item-name">{m.name}</span>
                            {m.isActive && <Check size={12} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button className="button" onClick={async () => {
                  const path = await (window as any).api?.pickModelFile();
                  if (path) {
                    setIsStarting(true);
                    const res = await (window as any).api?.startAI(path);
                    if (res?.success) setIsRunning(true);
                    setIsStarting(false);
                  }
                }} disabled={isStarting} style={{ fontSize: '13px' }} title="Load model manually">
                  Select Model
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="button" onClick={async () => {
                  const modelPath = await (window as any).api?.pickModelFile();
                  if (modelPath) {
                    const mmprojPath = await (window as any).api?.pickMmprojFile();
                    if (mmprojPath) {
                      setIsStarting(true);
                      const res = await (window as any).api?.startAI(modelPath, mmprojPath);
                      if (res?.success) setIsRunning(true);
                      setIsStarting(false);
                    }
                  }
                }} title="Load vision model (GGUF + MMRPOJ)" style={{ fontSize: '11px', padding: '4px 8px' }}>
                  <ImageIcon size={13} /> Vision
                </button>
                {currentSession && (
                  <button className="button" onClick={() => handleExportSession(currentSession)} title="Export Current Chat" style={{ fontSize: '11px', padding: '4px 8px' }}>
                    <Download size={13} /> Export
                  </button>
                )}
                <button className="button" onClick={() => fileInputRef.current?.click()} title="Import Chat" style={{ fontSize: '11px', padding: '4px 8px' }}>
                  <Upload size={13} /> Import
                </button>
                <button className="button button-danger" onClick={clearChat} style={{ fontSize: '11px', padding: '4px 8px' }}>
                  <Trash2 size={13} /> Clear Session
                </button>
                
                {aiModels.length > 0 && (
                  <div className="ai-custom-dropdown" ref={dropdownRef}>
                    <button 
                      className={`ai-model-select-topbar ${showModelDropdown ? 'open' : ''}`}
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                    >
                      {aiModels.find(m => m.isActive)?.name || 'Select Model...'}
                    </button>
                    {showModelDropdown && (
                      <div className="ai-custom-dropdown-list">
                        {aiModels.map(m => (
                          <div 
                            key={m.id} 
                            className={`ai-custom-dropdown-item ${m.isActive ? 'active' : ''}`}
                            onClick={() => {
                              handleSwitchModel(m);
                              setShowModelDropdown(false);
                            }}
                          >
                            <span className="item-name">{m.name}</span>
                            {m.isActive && <Check size={12} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

        {/* Command mode indicator */}
        {planMode && (
          <div className="ai-plan-banner">
            <ChevronRight size={14} />
            {input.trimStart().startsWith('/thinking') ? (
              <><strong>/thinking mode</strong> — High-accuracy reasoning enabled. I will analyze deeply before answering.</>
            ) : input.trimStart().startsWith('/diagram') ? (
              <><strong>/diagram mode</strong> — Chart and architecture visualization enabled.</>
            ) : (
              <><strong>/plan mode</strong> — Describe the project and I'll create all files automatically in a new repository.</>
            )}
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
              <h3>GitFusion X AI Assistant</h3>
              <p>Ask anything about code, use <code>/plan</code> to scaffold, <code>/thinking</code> for deep reasoning, or <code>/diagram</code> for charts.</p>
              <div className="ai-hints">
                <span onClick={() => setInput('/thinking Explain complex neural networks')}>/thinking Analysis</span>
                <span onClick={() => setInput('/plan a React todo app')}>/plan Scaffolding</span>
                <span onClick={() => setInput('/diagram a REST API architecture')}>/diagram REST API</span>
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <AIMessage
                key={i}
                role={m.role}
                content={m.content}
                reasoning={m.reasoning}
                image={m.image}
                stats={m.stats}
                onImageClick={(img) => setLightboxImage(img)}
                onEdit={() => {
                  setInput(m.content);
                  if (m.image) setSelectedImage(m.image);
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }}
                isStreaming={i === messages.length - 1 && m.role === 'user' ? false : (i === messages.length - 1 && m.role === 'assistant' && isStreaming)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`ai-input-bar ${planMode ? 'plan-mode' : ''}`}>
          {selectedImage && (
            <div className="ai-image-preview-container">
              <div className="ai-image-preview">
                <img src={selectedImage} alt="Selected" />
                <button className="ai-remove-image" onClick={() => setSelectedImage(null)}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="ai-input-row">
            <input
              type="file"
              ref={imageInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleImageUpload}
            />
            <button
              className="ai-image-upload-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={!isRunning || isStreaming}
              title="Upload image"
            >
              <ImageIcon size={20} />
            </button>

            <div className="ai-thinking-toggle-direct">
              <button
                className={`toggle-btn ${thinkingMode === 'none' ? 'active' : ''}`}
                onClick={() => setThinkingMode('none')}
                title="Direct mode"
              >
                Direct
              </button>
              <button
                className={`toggle-btn ${thinkingMode === 'think' ? 'active' : ''}`}
                onClick={() => setThinkingMode('think')}
                title="Deep Thinking mode"
              >
                Think
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="ai-textarea"
              placeholder={isConnecting ? 'Wait please, connecting to engine...' : (isRunning
                ? (planMode ? 'Describe your project... (Enter to send)' : 'Message Copilot...')
                : 'Start the engine to begin chatting')}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!isRunning || isConnecting}
              rows={1}
              autoComplete="off"
            />
            {isStreaming ? (
              <button className="ai-stop-btn" onClick={stopGeneration} title="Stop">
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button className="ai-send-btn" onClick={doSend}
                disabled={!isRunning || (!input.trim() && !selectedImage)} title="Send (Enter)">
                <Send size={16} />
              </button>
            )}
          </div>
          <div className="ai-hint">
            Shift+Enter for newline · /plan to scaffold · /diagram for charts
          </div>
        </div>

        {/* Lightbox Modal */}
        {lightboxImage && (
          <div className="ai-lightbox" onClick={() => setLightboxImage(null)}>
            <div className="ai-lightbox-content">
              <img src={lightboxImage} alt="Fullscreen View" />
              <button className="ai-lightbox-close"><X size={24} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual message component ──────────────────────────────────────────────
function AIMessage({ role, content, reasoning, image, stats, onImageClick, onEdit, isStreaming }: {
  role: string; content: string; reasoning?: string; image?: string;
  stats?: { time: number; tokens: number };
  onImageClick?: (img: string) => void; onEdit?: () => void; isStreaming: boolean;
}) {
  const { thinkingMode } = useAI();
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
      <div className="ai-plan-container">
        <div className="ai-plan-header">
          <CheckSquare size={16} />
          <span>Generating Project Structure...</span>
        </div>
        <ul className="ai-plan-file-list">
          {parsedFiles.map((file, idx) => {
            const isCurrent = idx === parsedFiles.length - 1 && !isFinished;
            const isExpanded = !!expandedFiles[file.path];

            return (
              <li key={idx} className={`ai-plan-file-item ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="ai-plan-file-row"
                  onClick={() => setExpandedFiles(p => ({ ...p, [file.path]: !p[file.path] }))}
                >
                  {isCurrent ? <Loader size={14} className="ai-spin" /> : <Check size={14} color="var(--green)" />}
                  <span className="ai-plan-file-path">{file.path}</span>
                  <ChevronRight size={14} className="ai-plan-expand-icon" />
                </div>

                {isExpanded && (
                  <div className="ai-plan-file-preview">
                    <Markdown content={`\`\`\`${file.path.split('.').pop() || ''}\n${file.content}\n\`\`\``} isStreaming={isCurrent} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
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
        <div className="ai-msg-text">
          {reasoning && thinkingMode === 'think' && (
            <details className="ai-reasoning-block" open={isStreaming}>
              <summary>AI Reasoning</summary>
              <div className="ai-reasoning-content">
                <Markdown content={reasoning} />
              </div>
            </details>
          )}
          {image && (
            <div className="ai-msg-image">
              <img src={image} alt="User upload" onClick={() => onImageClick?.(image)} />
            </div>
          )}
          {renderContent}
          {isStreaming && !isPlan && (
            <div className="ai-thinking-spinner" style={{ marginTop: '8px' }}>
              <div className="ai-notch" />
              <span style={{ fontSize: '12px' }}>
                {!content && !reasoning 
                  ? (thinkingMode === 'think' ? 'Thinking...' : 'Processing...') 
                  : (thinkingMode === 'think' && !content ? 'Thinking...' : 'Generating...')}
              </span>
            </div>
          )}
          {stats && role === 'assistant' && (
            <div className="ai-msg-stats">
              <span title="Generation Time">
                <Clock size={10} /> {stats.time}s
              </span>
              <span title="Tokens spent">
                <Zap size={10} /> {stats.tokens} tokens
              </span>
            </div>
          )}
        </div>
        {!isStreaming && !isPlan && (
          <div className="ai-msg-actions">
            {role === 'user' && !isStreaming && onEdit && (
              <button className="ai-action-btn" onClick={onEdit} title="Edit message">
                <Edit2 size={13} /> Edit
              </button>
            )}
            {role === 'assistant' && content && (
              <button className="ai-action-btn" onClick={handleCopy} title="Copy response">
                <Copy size={13} /> Copy
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// v1.1 - Verified clean export
