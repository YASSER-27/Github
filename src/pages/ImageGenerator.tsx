import { useState, useEffect, useRef } from 'react';
import {
  Trash2, Download, X, History, PanelLeftOpen, PanelLeftClose,
  Sparkles, Square, Copy, Check, Clock, AlertTriangle
} from 'lucide-react';
import './ImageGenerator.css';

const api = () => (window as any).api;

interface ChatMessage {
  id: string;
  type: 'prompt' | 'image' | 'error';
  content: string;   // prompt text OR image path OR error message
  prompt?: string;   // for image messages
  duration?: string; // generation time in seconds
  timestamp: number;
}

const QUALITY_PRESETS = [
  { id: 'turbo', label: 'Turbo', steps: 1, cfg: 1.0 },
  { id: 'ultra-fast', label: 'Ultra Fast', steps: 2, cfg: 1.2 },
  { id: 'fast', label: 'Fast', steps: 4, cfg: 1.5 },
  { id: 'balanced', label: 'Balanced', steps: 6, cfg: 2.0 },
  { id: 'quality', label: 'Quality', steps: 10, cfg: 2.5 },
];

const ASPECT_RATIOS = [
  { id: 'default', label: 'Default', factor: [1, 1] },
  { id: '1:1', label: '1:1', factor: [1, 1] },
  { id: '16:9', label: '16:9', factor: [16, 9] },
  { id: '9:16', label: '9:16', factor: [9, 16] },
  { id: '4:3', label: '4:3', factor: [4, 3] },
  { id: '3:4', label: '3:4', factor: [3, 4] },
];

const SIZES = [
  { id: '64', label: '64px' },
  { id: '128', label: '128px' },
  { id: '256', label: '256px' },
  { id: '384', label: '384px' },
  { id: '512', label: '512px' },
  { id: '768', label: '768px' },
  { id: '1024', label: '1024px' },
];

function getResolution(aspect: string, size: string) {
  let base = parseInt(size);
  const scaledBase = Math.max(256, base); 

  if (aspect === 'default') return { w: scaledBase, h: scaledBase };
  const ar = ASPECT_RATIOS.find(a => a.id === aspect)!;
  const [rw, rh] = ar.factor;
  const minFactor = Math.min(rw, rh);

  const w = Math.round((rw * scaledBase / minFactor) / 64) * 64 || scaledBase;
  const h = Math.round((rh * scaledBase / minFactor) / 64) * 64 || scaledBase;
  return { w, h };
}

export default function ImageGenerator() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pendingPmt, setPendingPmt] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quality, setQuality] = useState(() => localStorage.getItem('ig_q') || 'fast');
  const [aspect, setAspect] = useState(() => localStorage.getItem('ig_a') || 'default');
  const [size, setSize] = useState(() => localStorage.getItem('ig_s') || '512');
  const [settings, setSettings] = useState<any>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Boot: restore state if generation was running ── */
  useEffect(() => {
    const boot = async () => {
      const setts = await api()?.getSettings?.();
      setSettings(setts);

      // Load previous generated images from history
      const history = await api()?.getGeneratedImages?.();
      if (history && history.length > 0) {
        setMessages(history.reverse().map((img: any) => ({
          id: `hist-${img.name}`,
          type: 'image',
          content: img.path,
          timestamp: new Date(img.date).getTime(),
        })));
      }

      // Check generating status
      const status = await api()?.getImageGenStatus?.();
      if (status?.generating) {
        // Still running — show skeleton
        setGenerating(true);
        setPendingPmt(status.prompt ?? '...');
        setStartTime(status.startedAt ?? Date.now());
        setMessages(prev => {
          if (prev.find(m => m.type === 'prompt' && m.content === status.prompt)) return prev;
          return [...prev, {
            id: `restored-${Date.now()}`,
            type: 'prompt',
            content: status.prompt ?? '...',
            timestamp: status.startedAt ?? Date.now(),
          }];
        });
      } else {
        // Not generating — check if there's a result we missed while away
        const lastResult = await api()?.getImageGenLastResult?.();
        if (lastResult) {
          if (lastResult.success) {
            setMessages(prev => [...prev, {
              id: `img-${Date.now()}`,
              type: 'image',
              content: lastResult.imagePath,
              prompt: lastResult.prompt,
              duration: lastResult.duration,
              timestamp: Date.now(),
            }]);
          } else {
            setMessages(prev => [...prev, {
              id: `err-${Date.now()}`,
              type: 'error',
              content: lastResult.message ?? 'Generation failed',
              timestamp: Date.now(),
            }]);
          }
        }
      }
    };

    boot();

    // Listen for real-time completion
    const unsub = api()?.onImageGenComplete?.((result: any) => {
      setGenerating(false);
      setPendingPmt(null);
      setStartTime(null);
      setStatusLine('');
      if (result.success) {
        setMessages(prev => [...prev, {
          id: `img-${Date.now()}`,
          type: 'image',
          content: result.imagePath,
          prompt: result.prompt,
          duration: result.duration,
          timestamp: Date.now(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          type: 'error',
          content: result.message ?? 'Generation failed',
          timestamp: Date.now(),
        }]);
      }
    });

    const unsubLogs = api()?.onImageGenLog?.((log: string) => {
      if (log.includes('get sd version from file failed')) {
        setStatusLine('Error: Not a valid Image Model (Found Chat/LLM model instead)');
      } else if (log.includes('%]')) {
        const match = log.match(/\[\s*(\d+)%\]/);
        if (match) setStatusLine(`Progress: ${match[1]}%`);
      } else if (log.toLowerCase().includes('sampling')) {
        setStatusLine('Image Generator...');
      } else if (log.toLowerCase().includes('loading')) {
        setStatusLine('Loading …');
      }
    });

    const handleFocus = () => loadSettings();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsub?.();
      unsubLogs?.();
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating]);

  /* ── Persist Settings ── */
  useEffect(() => { localStorage.setItem('ig_q', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('ig_a', aspect); }, [aspect]);
  useEffect(() => { localStorage.setItem('ig_s', size); }, [size]);

  /* ── Live Timer ── */
  useEffect(() => {
    let interval: any;
    if (generating && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [generating, startTime]);

  const loadSettings = async () => {
    const s = await api()?.getSettings?.();
    if (s) setSettings(s);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !settings?.imageModel || generating) return;
    const text = prompt.trim();
    setPrompt('');

    // Add prompt bubble immediately
    const promptMsg: ChatMessage = {
      id: `p-${Date.now()}`, type: 'prompt', content: text, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, promptMsg]);
    setGenerating(true);
    setPendingPmt(text);
    setStartTime(Date.now());
    setStatusLine('Pausing Chat AI for speed...');

    const preset = QUALITY_PRESETS.find(p => p.id === quality) ?? QUALITY_PRESETS[2];
    const { w, h } = getResolution(aspect, size);
    const flux = settings.fluxModels || {};

    /* Fire-and-forget: the result comes via onImageGenComplete event */
    try {
      api()?.generateImage({
        prompt: text,
        modelPath: settings.imageModel,
        vaePath: flux.vae, clipLPath: flux.clip_l, t5xxlPath: flux.t5xxl,
        width: w, height: h, steps: preset.steps, cfgScale: preset.cfg,
      });
    } catch (e) {
      console.error('IPC Error:', e);
      setGenerating(false);
      setPendingPmt(null);
      setStartTime(null);
      setStatusLine('Error: IPC Failure');
    }
  };

  const handleStop = async () => {
    await api()?.stopGenerateImage?.();
    setGenerating(false);
    setPendingPmt(null);
    setStartTime(null);
  };

  const downloadImage = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `GitFusionX_${Date.now()}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1800);
  };

  const deleteMessage = async (id: string, path?: string) => {
    if (path) {
      await api()?.deleteGeneratedImage?.(path);
    }
    setMessages(prev => prev.filter(m => m.id !== id));
  };


  const activeMessages = messages.filter(m => !m.id.startsWith('hist-'));

  const allImages = messages.filter(m => m.type === 'image');

  return (
    <div className="ig-wrapper">

      {/* ── Sidebar (Gallery) ── */}
      {sidebarOpen && (
        <aside className="ig-sidebar">
          <div className="ig-sidebar-header">
            <History size={15} />
            <span style={{ flex: 1 }}>Recently Generated</span>
            <button className="ig-icon-btn sm" onClick={() => setMessages(prev => prev.filter(m => m.type !== 'image'))} title="Clear View (Session Only)">
              <X size={14} />
            </button>
            <button className="ig-icon-btn" onClick={() => setSidebarOpen(false)}>
              <PanelLeftClose size={15} />
            </button>
          </div>
          <div className="ig-sidebar-body">
            {allImages.length === 0 ? (
              <div className="ig-sidebar-empty">No images yet</div>
            ) : allImages.map(img => (
              <div key={img.id} className="ig-grid-item sidebar-grid-item" onClick={() => setLightbox(img.content)}>
                <img
                  src={img.content}
                  alt=""
                  className="ig-gallery-thumb"
                />
                <div className="ig-grid-overlay">
                  <button className="ig-small-btn" onClick={(e) => { e.stopPropagation(); downloadImage(img.content); }} title="Download">
                    <Download size={12} />
                  </button>
                  <button className="ig-small-btn danger" onClick={(e) => { e.stopPropagation(); deleteMessage(img.id, img.content); }} title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <div className="ig-main">
        {/* Global Particles - Always Visible for Aesthetics */}
        <div className="ig-particle-bg global-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="ig-particle" style={{ '--i': i } as any} />
          ))}
        </div>

        {/* Topbar */}
        <div className="ig-topbar">
          <button className="ig-icon-btn" onClick={() => setSidebarOpen(v => !v)} title="Gallery">
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <div className="ig-topbar-model">
            <span className={`ig-dot ${settings?.imageModel ? 'online' : ''}`} />
            <span className="ig-model-name">
              {settings?.imageModel
                ? settings.imageModel.split(/[\\/]/).pop()
                : 'No model configured — go to Settings'}
            </span>
          </div>
        </div>

        {settings?.imageModel?.toLowerCase().endsWith('.safetensors') && !generating && (
          <div className="ig-perf-warning bounce-in" style={{
            background: 'rgba(255, 170, 0, 0.1)',
            borderBottom: '1px solid rgba(255, 170, 0, 0.2)',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#ffaa00',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={14} />
            <span>Using .safetensors on CPU is 10x slower. Please use a .gguf model for speed.</span>
          </div>
        )}

        {/* Chat area */}
        <div className="ig-chat-area">
          {activeMessages.length === 0 && !generating && (
            <div className="ig-empty">
              <div className="ai-circles-demo">
                <div className="ai-circle-multiple">
                  <div className="ai-circle" />
                  <div className="ai-circle" />
                  <div className="ai-circle" />
                </div>
              </div>
              <h3>Image Generator</h3>
              <p>Enter a prompt below to generate professional images with local AI.</p>
            </div>
          )}

          {activeMessages.map(msg => {
            if (msg.type === 'prompt') return (
              <div key={msg.id} className="ig-row ig-row-right">
                <div className="ig-bubble ig-bubble-prompt">
                  <p className="ig-prompt-text">{msg.content}</p>
                  <button className="ig-copy-btn" onClick={() => copyText(msg.content)}>
                    {copied === msg.content ? <Check size={11} /> : <Copy size={11} />}
                    {copied === msg.content ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            );

            if (msg.type === 'image') return (
              <div key={msg.id} className="ig-row ig-row-left">
                <div className="ig-bubble ig-bubble-image">
                  <img
                    src={msg.content}
                    alt="Generated"
                    className="ig-result-img"
                    onClick={() => setLightbox(msg.content)}
                  />
                  <div className="ig-img-actions">
                    {msg.duration && (
                      <span className="ig-duration" title="Generation time">
                        <Clock size={11} /> {msg.duration}s
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <button className="ig-small-btn" onClick={() => {
                      if (msg.prompt) {
                        setPrompt(msg.prompt);
                        textareaRef.current?.focus();
                      }
                    }} title="Re-generate">
                      ↺ Again
                    </button>
                    <button className="ig-small-btn" onClick={() => downloadImage(msg.content)}>
                      <Download size={13} /> Save
                    </button>
                    <button className="ig-small-btn danger" onClick={() => deleteMessage(msg.id, msg.content)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );

            if (msg.type === 'error') return (
              <div key={msg.id} className="ig-row ig-row-left">
                <div className="ig-bubble ig-bubble-error">
                  <X size={13} />
                  <span>{msg.content}</span>
                  <button className="ig-icon-btn sm" onClick={() => deleteMessage(msg.id)}><X size={11} /></button>
                </div>
              </div>
            );

            return null;
          })}

          {/* Skeleton while generating */}
          {generating && pendingPmt && (
            <div className="ig-row ig-row-left">
              <div className="ig-bubble ig-bubble-skeleton" style={{ aspectRatio: aspect.replace(':', '/') }}>
                {/* Specific glow/particles inside the skeleton */}
                <div className="ig-particle-bg">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="ig-particle" style={{ '--i': i } as any} />
                  ))}
                </div>
                <div className="ig-glow-ring" />
                <div className="ig-skeleton-label">
                  <span>{statusLine || 'Image Generating...'}</span>
                  <span className="ig-elapsed">{elapsed}s</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="ig-input-section">
          <div className="ig-input-box">
            {/* Inline controls */}
            <div className="ig-controls">
              <select className="ig-sel" value={quality} onChange={e => setQuality(e.target.value)}>
                {QUALITY_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <span className="ig-divider" />
              <select className="ig-sel" value={aspect} onChange={e => setAspect(e.target.value)}>
                {ASPECT_RATIOS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <span className="ig-divider" />
              <select className="ig-sel" value={size} onChange={e => setSize(e.target.value)}>
                {SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <textarea
              ref={textareaRef}
              className="ig-textarea"
              placeholder={generating ? 'Generating in background...' : 'Describe your image…'}
              value={prompt}
              rows={1}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
              }}
              disabled={!settings?.imageModel}
            />

            <div className="ig-btn-group">
              {generating ? (
                <button className="ig-send-btn ig-stop-active" onClick={handleStop} title="Stop Generation">
                  <Square size={13} fill="currentColor" />
                  Stop
                </button>
              ) : (
                <button
                  className="ig-send-btn"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || !settings?.imageModel}
                >
                  <Sparkles size={15} />
                  Generate
                </button>
              )}
            </div>
          </div>
          <div className="ig-hint">
            {quality} · {aspect} · {size}px · Enter to generate · generation continues in background
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="ig-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full" />
          <button className="ig-lightbox-close" onClick={() => setLightbox(null)}><X size={20} /></button>
        </div>
      )}
    </div>
  );
}
