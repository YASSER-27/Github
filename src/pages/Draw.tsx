import { useState, useEffect, useRef } from 'react';
import { Excalidraw, MainMenu, Footer, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';
import { useAI } from '../context/AIContext';
import { Wand2, Loader2, Play, X, RotateCcw } from 'lucide-react';
import "@excalidraw/excalidraw/index.css";
import './Draw.css';

interface DrawMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DrawSession {
  id: string;
  title: string;
  messages: DrawMessage[];
  timestamp: number;
}

export default function Draw() {
  const { setInput } = useAI();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(() => localStorage.getItem('gitbot_draw_ai_panel') !== 'false');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('gitbot_draw_active_theme') || 'default');
  const [sessions, setSessions] = useState<DrawSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const saveTimerRef = useRef<any>(null);

  const [initialData] = useState(() => {
    const saved = localStorage.getItem('gitbot_draw_elements');
    if (saved) {
      try { return { elements: JSON.parse(saved) }; } catch (e) { return null; }
    }
    return null;
  });

  // Load chats on mount
  useEffect(() => {
    const saved = localStorage.getItem('gitbot_draw_chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) {
        console.error("Failed to load draw chats", e);
      }
    }
  }, []);

  // Save chats on change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('gitbot_draw_chats', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Persist UI States
  useEffect(() => {
    localStorage.setItem('gitbot_draw_ai_panel', String(aiPanelOpen));
  }, [aiPanelOpen]);

  useEffect(() => {
    localStorage.setItem('gitbot_draw_active_theme', activeTheme);
  }, [activeTheme]);

  const handleCanvasChange = (elements: readonly any[]) => {
    // Only save if we have elements or were already drawing
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem('gitbot_draw_elements', JSON.stringify(elements));
    }, 300); // Faster debounce
  };

  // Helper functions removed as they are currently unused in the UI
  // const currentSession = sessions.find(s => s.id === currentSessionId);
  // ... (keeping sessions state but removing unused helpers for build)

  useEffect(() => {
    // Sync with Gitbot theme
    const updateTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme && (currentTheme.includes('light') || currentTheme === 'modern-white')) {
        setTheme('light');
      } else {
        setTheme('dark');
      }
    };

    updateTheme();

    // Observer for theme and to force-hide pesky Mermaid/Help/Library elements
    const observer = new MutationObserver(() => {
      updateTheme();

      // 1. Target by known selectors
      const targets = document.querySelectorAll(
        '[data-testid="mermaid"], [aria-label*="Mermaid"], [title*="Mermaid"], ' +
        '.help-icon, [data-testid="toggle-library"], [aria-label*="Library"], [title*="Library"], ' +
        'button[aria-label^="Mermaid"], .dropdown-menu-item[aria-label*="Mermaid"]'
      );
      targets.forEach(el => (el as HTMLElement).style.display = 'none');

      // 2. Target by text content (Aggressive scan)
      const allSpansAndButtons = document.querySelectorAll("span, button, div.dropdown-menu-item, div.Stack h3");
      allSpansAndButtons.forEach(el => {
        const txt = el.textContent || "";
        if (txt.includes("Mermaid") || txt === "Generate") {
          (el as HTMLElement).style.display = "none";
          // If it's a menu item, hide the parent if needed, but display none on self is usually enough
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const sanitizeMermaid = (code: string) => {
    // 1. Ensure node labels are quoted to avoid syntax errors with (), [], etc.
    // Flowchart: id[label] -> id["label"]
    let sanitized = code;
    
    // Pattern for id[text], id(text), id{text}, id>text, etc.
    // We target common shapes
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]+)\[(.*?)\]/g, (m, id, label) => {
      if (label.startsWith('"') && label.endsWith('"')) return m;
      return `${id}["${label}"]`;
    });
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]+)\{(.*?)\}/g, (m, id, label) => {
      if (label.startsWith('"') && label.endsWith('"')) return m;
      return `${id}{"${label}"}`;
    });
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]+)\((.*?)\)/g, (m, id, label) => {
      if (label.startsWith('"') && label.endsWith('"')) return m;
      return `${id}("${label}")`;
    });

    return sanitized;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);

    try {
      // Use /diagram command
      setInput(`/diagram ${prompt}`);

      // We manually trigger sendMessage logic if possible or just wait for it
      // Since sendMessage relies on the 'input' state which we just set, we might need a small delay
      // Or better, we call a specialized function. But here we'll use the context's sendMessage.

      // Wait for AI response in messages
      // This is slightly tricky with the current AIContext.
      // For now, let's use a simpler way: call the fetch directly or reuse the logic.

      // We'll simulate the AI call for better control in this page
      const resp = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a professional diagram specialist. Respond ONLY with a Mermaid code block. CRITICAL: Always wrap node labels in double quotes (e.g., A["Label (with) characters"]) to prevent parse errors.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        }),
      });

      if (!resp.ok) throw new Error('AI Engine is not running.');
      const data = await resp.json();
      const assistantContent = data.choices[0].message.content;

      // Update history
      const userMessage: DrawMessage = { role: 'user', content: prompt };
      const assistantMessage: DrawMessage = { role: 'assistant', content: assistantContent };

      if (currentSessionId) {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const newMessages = [...s.messages, userMessage, assistantMessage];
            // Update title if it's the first message
            const newTitle = s.messages.length === 0 ? (prompt.length > 25 ? prompt.substring(0, 25) + '...' : prompt) : s.title;
            return { ...s, messages: newMessages, title: newTitle, timestamp: Date.now() };
          }
          return s;
        }));
      } else {
        // Create new session if none active
        const newId = Date.now().toString();
        const newSession: DrawSession = {
          id: newId,
          title: prompt.length > 25 ? prompt.substring(0, 25) + '...' : prompt,
          messages: [userMessage, assistantMessage],
          timestamp: Date.now()
        };
        setSessions([newSession, ...sessions]);
        setCurrentSessionId(newId);
      }

      // Extract mermaid code
      const mermaidMatch = assistantContent.match(/```mermaid\n([\s\S]*?)\n```/) || assistantContent.match(/```\n?([\s\S]*?)\n```/);
      let mermaidCode = mermaidMatch ? mermaidMatch[1] : assistantContent;

      // Sanitize to prevent syntax errors
      mermaidCode = sanitizeMermaid(mermaidCode);

      if (!excalidrawAPI) throw new Error('Excalidraw not ready.');

      // 1. Parse Mermaid to skeletons
      const { elements } = await parseMermaidToExcalidraw(mermaidCode, {
        themeVariables: {
          fontSize: "20px",
        },
      });

      // 2. Convert to Excalidraw elements
      let fullElements = convertToExcalidrawElements(elements);

      // 3. Normalization Fix: Filter out or fix invalid linear elements that cause "not normalized" error
      fullElements = fullElements.filter(el => {
        if (el.type === "arrow" || el.type === "line") {
          const points = (el as any).points || [];
          return points.length >= 2;
        }
        return true;
      });

      // 4. Add to scene
      try {
        excalidrawAPI.updateScene({
          elements: [...excalidrawAPI.getSceneElements(), ...fullElements],
          appState: { zoom: { value: 1 } }
        });
      } catch (sceneErr) {
        console.error("Scene update error:", sceneErr);
        // Fallback: try update without previous elements if it's a conflict
        excalidrawAPI.updateScene({ elements: fullElements });
      }

      setPrompt('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="draw-page fade-in">
      {/* Main Container */}
      <div className="draw-container">
        {/* Decorative Background Themes - Now inside container */}
        <div className={`draw-backdrop theme-${activeTheme}`}>
          <div className="blur-orb orb-1"></div>
          <div className={`blur-orb orb-2 theme-${activeTheme}`}></div>
          <div className="blur-orb orb-3"></div>
        </div>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleCanvasChange}
          initialData={initialData}
          theme={theme}
          // Hide external links via UIOptions
          UIOptions={{
            canvasActions: {
              toggleTheme: true,
              export: { saveFileToDisk: true },
              loadScene: true,
              clearCanvas: false,
            },
            tools: {
              image: false,
            }
          }}
        >
          {/* Custom MainMenu to remove external links and reorder items */}
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            
            {/* Branded Themes Integrated into Menu */}
            <div className="menu-themes-section">
              <span className="menu-themes-label">Branded Themes</span>
              <div className="theme-switcher in-menu">
                <button 
                  className={`theme-dot default ${activeTheme === 'default' ? 'active' : ''}`} 
                  onClick={() => setActiveTheme('default')}
                  title="Default"
                />
                <button 
                  className={`theme-dot ocean ${activeTheme === 'ocean' ? 'active' : ''}`} 
                  onClick={() => setActiveTheme('ocean')}
                  title="Ocean"
                />
                <button 
                  className={`theme-dot sunset ${activeTheme === 'sunset' ? 'active' : ''}`} 
                  onClick={() => setActiveTheme('sunset')}
                  title="Sunset"
                />
                <button 
                  className={`theme-dot nebula ${activeTheme === 'nebula' ? 'active' : ''}`} 
                  onClick={() => setActiveTheme('nebula')}
                  title="Nebula"
                />
              </div>
            </div>
          </MainMenu>
          <Footer />
        </Excalidraw>
      </div>

      {/* AI Assistant Floating Window */}
      <div className={`draw-ai-window ${aiPanelOpen ? 'open' : 'closed'}`}>
        <div className="window-header">
          <div className="window-title">
            <span>AI Copilot</span>
          </div>
          <button className="window-close" onClick={() => setAiPanelOpen(false)}>
            <X size={14} />
          </button>
        </div>

        <div className="window-content">
          <p className="window-hint">Describe a diagram to generate...</p>
          <textarea
            className="window-textarea"
            placeholder="e.g. Microservices flow..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
          />

          {error && <div className="window-error">{error}</div>}

          <button
            className="window-btn"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
          >
            {generating ? <Loader2 size={14} className="ai-spin" /> : <Play size={14} />}
            {generating ? 'Generating...' : 'Magic Draw'}
          </button>

          <button 
            className="window-btn new-btn" 
            onClick={() => {
              if (excalidrawAPI) {
                excalidrawAPI.updateScene({ elements: [] });
              }
            }}
          >
            <RotateCcw size={14} /> Reset Canvas
          </button>

          <div className="window-footer">
            <div className="theme-switcher">
              <button 
                className={`theme-dot default ${activeTheme === 'default' ? 'active' : ''}`} 
                onClick={() => setActiveTheme('default')}
                title="Default"
              />
              <button 
                className={`theme-dot ocean ${activeTheme === 'ocean' ? 'active' : ''}`} 
                onClick={() => setActiveTheme('ocean')}
                title="Ocean"
              />
              <button 
                className={`theme-dot sunset ${activeTheme === 'sunset' ? 'active' : ''}`} 
                onClick={() => setActiveTheme('sunset')}
                title="Sunset"
              />
              <button 
                className={`theme-dot nebula ${activeTheme === 'nebula' ? 'active' : ''}`} 
                onClick={() => setActiveTheme('nebula')}
                title="Nebula"
              />
            </div>
            <span>Yasser-27</span>
          </div>
        </div>
      </div>

      {!aiPanelOpen && (
        <button className="sidebar-toggle" onClick={() => setAiPanelOpen(true)}>
          <Wand2 size={20} />
        </button>
      )}
    </div>
  );
}
