import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export type Message = { 
  id: string;
  role: 'user' | 'assistant' | 'system'; 
  content: string; 
  reasoning?: string; 
  raw?: string;
  image?: string; // Base64 image data
  stats?: { time: number; tokens: number };
};

export type AISession = {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
};

interface AIContextType {
  sessions: AISession[];
  setSessions: React.Dispatch<React.SetStateAction<AISession[]>>;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  error: string | null;
  sendMessage: () => Promise<void>;
  stopGeneration: () => void;
  clearChat: () => void;
  createNewSession: () => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  messages: Message[];
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  thinkingMode: 'none' | 'think';
  setThinkingMode: (v: 'none' | 'think') => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const PLAN_SYSTEM = `You are a project scaffolding expert. When given a project description, respond ONLY with a JSON object (no markdown, no explanation) in this exact format:
{
  "name": "repo-name-kebab-case",
  "files": [
    { "path": "relative/path/to/file.ext", "content": "full file content here" }
  ]
}
Include all necessary files: source code, package.json, README.md, etc.
IMPORTANT: DO NOT USE EMOJIS IN YOUR RESPONSE.`;

const DIAGRAM_SYSTEM = `You are a technical diagram specialist. When asked to create a diagram, choose the BEST format:
- Use **Mermaid** (wrapped in \`\`\`mermaid) for: flowcharts, sequences, class diagrams, ER diagrams, state machines, Gantt charts.
- Use **ASCII Art** for: simple trees, small tables, text-based layouts.
- Use **Graphviz DOT** (wrapped in \`\`\`dot) for: complex graphs and networks.

RULES:
1. Always output ONLY the diagram code in a fenced code block — no prose before it.
2. Add a short one-line title comment at the top of the diagram.
3. After the diagram block, add a 2-sentence plain-text explanation.
4. For Mermaid, prefer LR or TD direction depending on content.
5. **IMPORTANT (Mermaid)**: 
   - Always use double quotes for ALL node labels: A["Label"]
   - Avoid colons (:), brackets ([]), or math symbols (+, *, /, =) inside labels if possible.
   - If you MUST use a colon or dash, ensure it is inside double quotes and the node ID is simple alphanumeric: Node1["Identify Numbers: 15 and 2"]
   - **Sequence Diagrams**: Only use \`activate\` if you have a corresponding \`deactivate\`. Avoid nested activation if it's too complex. Ensure every activated participant is deactivated exactly once.
6. Keep diagrams readable — max 15 nodes per diagram.`;

const THINKING_SYSTEM = `You are a high-accuracy reasoning assistant. 
When asked to think or solve complex problems:
1. Always start your response with a <think> block explaining your internal reasoning, edge cases, and plan.
2. Be extremely precise and thorough in your technical analysis.
3. After the </think> block, provide the final, high-quality answer.
Maintain a professional, expert tone. 
IMPORTANT: DO NOT USE EMOJIS IN YOUR RESPONSE.`;

const VISION_SYSTEM = `You are a professional vision assistant. Describe images precisely and fulfill image-related coding or analysis requests. DO NOT USE EMOJIS.`;

function parsePlanJSON(text: string): { name: string; files: { path: string; content: string }[] } | null {
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(cleaned);
  } catch {
    const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : `ai-project-${Date.now()}`;
    const files = [];
    const _parts = text.split(/"path"\s*:\s*"/).slice(1);
    for (const part of _parts) {
      const pMatch = part.match(/^([^"]+)"\s*,\s*"content"\s*:\s*"/);
      if (pMatch) {
        const pathName = pMatch[1];
        let contentPart = part.substring(pMatch[0].length);
        let endIdx = contentPart.lastIndexOf('"}');
        if (endIdx === -1) endIdx = contentPart.lastIndexOf('"');
        if (endIdx === -1) endIdx = contentPart.length;

        contentPart = contentPart.substring(0, endIdx);
        contentPart = contentPart.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        files.push({ path: pathName, content: contentPart });
      }
    }
    if (files.length > 0) return { name, files };
    return null;
  }
}

/**
 * Smart JSONL Streaming Parser (from Ollama reference)
 * Handles fragmented stream chunks and ensures robust JSON parsing.
 */
async function* parseJsonlFromStream<T>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          try { yield JSON.parse(buffer.trim()); } catch (e) { console.error('Final buffer parse error:', e); }
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Handle llama.cpp 'data: ' prefix if present
        const cleanLine = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
        if (cleanLine === '[DONE]') continue;
        try { yield JSON.parse(cleanLine); } catch (e) { console.error('Line parse error:', e); }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* parseJsonlFromResponse<T>(response: Response): AsyncGenerator<T, void, unknown> {
  if (!response.body) throw new Error("Response body is null");
  yield* parseJsonlFromStream<T>(response.body);
}


export function AIProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [thinkingMode, setThinkingMode] = useState<'none' | 'think'>('none');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('gitbot_sidebar_open');
    return saved === null ? true : saved === 'true';
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem('gitbot_sidebar_open', sidebarOpen.toString());
  }, [sidebarOpen]);

  // Load from multiple session storage
  useEffect(() => {
    const saved = localStorage.getItem('gitbot_ai_sessions_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) {
        // Fallback for old format
        const old = localStorage.getItem('gitbot_chat_v3');
        if (old) {
          try {
            const oldMsgs = JSON.parse(old);
            const initialSession: AISession = {
              id: 'legacy-session',
              title: 'Current Chat',
              messages: oldMsgs,
              timestamp: Date.now()
            };
            setSessions([initialSession]);
            setCurrentSessionId('legacy-session');
          } catch {}
        }
      }
    }
  }, []);

  // Save on change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('gitbot_ai_sessions_v1', JSON.stringify(sessions));
    }
  }, [sessions]);

  const createNewSession = useCallback(() => {
    const id = Date.now().toString();
    const newSession: AISession = {
      id,
      title: 'New Chat',
      messages: [],
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(id);
    setInput('');
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (currentSessionId === id) {
        setCurrentSessionId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }, [currentSessionId]);

  const renameSession = useCallback((id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearChat = useCallback(() => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [] } : s));
    stopGeneration();
  }, [currentSessionId, stopGeneration]);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && !selectedImage) || isStreaming) return;

    // Ensure we have a session
    let sessionId = currentSessionId;
    if (!sessionId) {
      const newId = Date.now().toString();
      const newSession: AISession = {
        id: newId,
        title: 'New Chat',
        messages: [],
        timestamp: Date.now()
      };
      setSessions([newSession]);
      setCurrentSessionId(newId);
      sessionId = newId;
    }

    const isPlan = input.trimStart().startsWith('/plan');
    const isThinking = thinkingMode === 'think' || input.trimStart().startsWith('/thinking');
    const userContent = input.trim();
    const currentImage = selectedImage;
    const userMsg: Message = { id: Date.now().toString() + '-u', role: 'user', content: userContent, image: currentImage || undefined };
    const assistantMsg: Message = { id: (Date.now() + 1).toString() + '-a', role: 'assistant', content: '' };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        // Auto-update title on first message
        const title = s.messages.length === 0 ? (userContent.length > 30 ? userContent.substring(0, 30) + '...' : userContent) : s.title;
        return { ...s, title, messages: [...s.messages, userMsg, assistantMsg], timestamp: Date.now() };
      }
      return s;
    }));

    const currentSession = sessions.find(s => s.id === sessionId);
    const historyMessages = currentSession ? currentSession.messages : [];

    setInput('');
    setSelectedImage(null);
    setIsStreaming(true);
    setError(null);

    const isDirectMode = thinkingMode === 'none' && !isThinking;
    let sysPrompt = 'Professional coding assistant. No emojis.';
    try {
      const s = await (window as any).api?.getSettings();
      sysPrompt = s?.systemPrompt || sysPrompt;
      
      // OPTIMIZATION: Skip skill files for Vision tasks to speed up pre-fill (Time-To-First-Token)
      if (s?.skillFiles?.length && !currentImage) {
        let skillContent = s.skillFiles.map((f: any) => `--- SKILL: ${f.name} ---\n${f.content}`).join('\n\n');
        if (skillContent.length > 800) skillContent = skillContent.substring(0, 800) + "\n\n...(Skills truncated for speed)...";
        sysPrompt += `\n\n# Skills\n${skillContent}`;
      }
      if (isDirectMode) {
        sysPrompt = 'You are a professional assistant. Answer directly and concisely. No thinking blocks allowed.';
      }
    } catch {}

    if (isPlan) sysPrompt = PLAN_SYSTEM;
    if (input.trimStart().startsWith('/diagram')) sysPrompt = DIAGRAM_SYSTEM;
    if (isThinking) sysPrompt = THINKING_SYSTEM;
    if (currentImage) sysPrompt = VISION_SYSTEM;

    const apiHistory = [
      { role: 'system', content: sysPrompt },
      ...historyMessages.slice(-5).map((m) => {
        // SMART OPTIMIZATION: Do not resend previous images as raw base64.
        // Vision models re-process images in Every prompt, causing O(N^2) delay.
        // We only send the text content of previous turns; the AI already 'remembered' the image details 
        // in its previous assistant response which is still in context.
        if (m.image && m.role === 'user') {
          return { role: 'user', content: `${m.content}\n\n[Context: User previously shared an image for which analysis was provided]` };
        }
        return { role: m.role, content: m.content };
      }),

      currentImage ? {
        role: 'user',
        content: [
          { type: 'text', text: userContent },
          { type: 'image_url', image_url: { url: currentImage } }
        ]
      } : { role: 'user', content: userContent }
    ];

    abortRef.current = new AbortController();
    let fullResponse = '';

    try {
      setIsStreaming(true);
      setError(null);
      const startTime = performance.now();
      let tokenCounter = 0;

      const resp = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: apiHistory,
          stream: true,
          temperature: (isPlan || isThinking) ? 0.2 : 0.7,
          max_tokens: 4096,
          // Suppress thinking tokens in direct mode (llama.cpp / Qwen thinking models)
          ...(isDirectMode ? {
            thinking: { type: 'disabled' },
            budget_tokens: 0,
          } : {}),
        }),
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

      // 🚀 PERFORMANCE OPTIMIZATION: Throttle state updates during streaming
      let lastUpdateTime = 0; // Set to 0 to ensure the FIRST token is always sent immediately
      const UPDATE_INTERVAL = 64; 

      // Track think-block state across chunks (for direct mode filtering)
      let rawBuffer = '';
      let isInsideThink = false;
      let isFirstToken = true;

      // Accumulator for streaming tokens to avoid frequent state clones
      let pendingToken = '';
      let pendingReasoning = '';

      const finalizeState = (force = false) => {
        const now = Date.now();
        // Skip throttle for the first token or if forced
        if (!force && !isFirstToken && now - lastUpdateTime < UPDATE_INTERVAL) return;
        
        lastUpdateTime = now;
        isFirstToken = false;

        const snapToken = pendingToken;
        const snapReasoning = pendingReasoning;
        pendingToken = '';
        pendingReasoning = '';

        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const arr = [...s.messages];
            const last = arr[arr.length - 1];
            if (last?.role === 'assistant') {
              const raw = (last.raw || '') + snapReasoning + snapToken;
              let reasoning = (last.reasoning || '') + snapReasoning;
              let answer = last.content || '';

              if (snapToken) {
                const lowerRaw = raw.toLowerCase();
                if (lowerRaw.includes('<think>')) {
                  const startIdx = lowerRaw.indexOf('<think>');
                  const endIdx = lowerRaw.indexOf('</think>');
                  if (endIdx !== -1) {
                    reasoning = raw.substring(startIdx + 7, endIdx).trim();
                    answer = (raw.substring(0, startIdx) + raw.substring(endIdx + 8)).trim();
                  } else {
                    reasoning = raw.substring(startIdx + 7);
                    answer = raw.substring(0, startIdx).trim();
                  }
                } else {
                  answer += snapToken;
                }
              }

              arr[arr.length - 1] = {
                ...last,
                content: answer,
                reasoning,
                raw,
                stats: { 
                  time: parseFloat(((performance.now() - startTime) / 1000).toFixed(2)), 
                  tokens: tokenCounter 
                }
              };
            }
            return { ...s, messages: arr };
          }
          return s;
        }));
      };

      for await (const json of parseJsonlFromResponse<any>(resp)) {
        const choice = json.choices?.[0];
        const token = choice?.delta?.content ?? choice?.delta?.text ?? choice?.text ?? '';
        const reasoningToken = choice?.delta?.reasoning_content ?? '';

        if (!token && !reasoningToken) continue;
        tokenCounter++;

        // ── DIRECT MODE: hard-block think tokens ───────────────────────────
        if (isDirectMode) {
          rawBuffer += token;
          if (!isInsideThink && rawBuffer.toLowerCase().includes('<think>')) isInsideThink = true;
          if (isInsideThink && rawBuffer.toLowerCase().includes('</think>')) {
            isInsideThink = false;
            const closeIdx = rawBuffer.toLowerCase().indexOf('</think>') + 8;
            rawBuffer = rawBuffer.substring(closeIdx);
          }
          if (isInsideThink) continue;

          const safeToken = rawBuffer;
          rawBuffer = '';
          if (!safeToken) continue;
          
          fullResponse += safeToken;
          pendingToken += safeToken;
          finalizeState();
          continue;
        }
        // ── END DIRECT MODE FILTER ─────────────────────────────────────────

        if (token) fullResponse += token;
        pendingToken += token;
        pendingReasoning += reasoningToken;
        finalizeState();
      }

      // Final commit
      finalizeState(true);


      if (isPlan && fullResponse) {
        const plan = parsePlanJSON(fullResponse);
        if (plan) {
          const result = await (window as any).api?.createRepoFromPlan(plan.name, plan.files);
          const statusMsg = result?.success
            ? `\n\n---\n**Repository created:** \`${result.name}\` with ${plan.files.length} files.\nNavigate to Repositories to view it.`
            : `\n\n---\n**Failed to create repository:** ${result?.message}`;
          setSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
              const arr = [...s.messages];
              const last = arr[arr.length - 1];
              if (last) arr[arr.length - 1] = { ...last, content: last.content + statusMsg };
              return { ...s, messages: arr };
            }
            return s;
          }));
        }
      }

      const endTime = performance.now();
      const finalTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
      const finalTokens = tokenCounter;

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          const arr = [...s.messages];
          const last = arr[arr.length - 1];
          if (last?.role === 'assistant') {
            arr[arr.length - 1] = { ...last, stats: { time: finalTime, tokens: finalTokens } };
          }
          return { ...s, messages: arr };
        }
        return s;
      }));

    } catch (err: any) {
      if (err.name !== 'AbortError') setError(`Connection failed: ${err.message}`);
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          const arr = [...s.messages];
          if (arr[arr.length - 1]?.role === 'assistant' && !arr[arr.length - 1].content) arr.pop();
          return { ...s, messages: arr };
        }
        return s;
      }));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, currentSessionId, sessions, thinkingMode, selectedImage]);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession ? currentSession.messages : [];

  return (
    <AIContext.Provider value={{ 
      sessions, setSessions, currentSessionId, setCurrentSessionId, 
      input, setInput, isStreaming, error, sendMessage, 
      stopGeneration, clearChat, createNewSession, deleteSession, renameSession,
      sidebarOpen, setSidebarOpen, messages, selectedImage, setSelectedImage,
      thinkingMode, setThinkingMode
    }}>
      {children}
    </AIContext.Provider>
  );
}

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
};
