import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

interface Message { role: 'user' | 'assistant' | 'system'; content: string; }

interface AIContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  error: string | null;
  sendMessage: () => Promise<void>;
  stopGeneration: () => void;
  clearChat: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const PLAN_SYSTEM = `You are a project scaffolding expert. When given a project description, respond ONLY with a JSON object (no markdown, no explanation) in this exact format:
{
  "name": "repo-name-kebab-case",
  "files": [
    { "path": "relative/path/to/file.ext", "content": "full file content here" }
  ]
}
Include all necessary files: source code, package.json, README.md, etc.`;

function parsePlanJSON(text: string): { name: string; files: { path: string; content: string }[] } | null {
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(cleaned);
  } catch {
    // Robust fallback for streamed/malformed JSON
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
        if (endIdx === -1) endIdx = contentPart.lastIndexOf('"'); // In case it gets cut cleanly
        if (endIdx === -1) endIdx = contentPart.length; // If string is just brutally cut off

        contentPart = contentPart.substring(0, endIdx);
        contentPart = contentPart.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        files.push({ path: pathName, content: contentPart });
      }
    }
    if (files.length > 0) return { name, files };
    return null;
  }
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gitbot_chat_v3');
    if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
  }, []);
  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('gitbot_chat_v3', JSON.stringify(messages));
  }, [messages]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearChat = useCallback(() => {
    localStorage.removeItem('gitbot_chat_v3');
    setMessages([]);
    stopGeneration();
  }, [stopGeneration]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const isPlan = input.trimStart().startsWith('/plan');
    const userContent = input.trim();
    const userMsg: Message = { role: 'user', content: userContent };
    const assistantMsg: Message = { role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    let sysPrompt = 'You are a professional coding assistant.';
    try {
      const s = await (window as any).api?.getSettings();
      sysPrompt = s?.systemPrompt || sysPrompt;
      if (s?.disableThinking) {
        sysPrompt += '\n\nIMPORTANT INSTRUCTION: You must answer directly and immediately. Do NOT output any <think> tags and do NOT think step-by-step. Provide your final response immediately.';
      }
    } catch {}

    if (isPlan) sysPrompt = PLAN_SYSTEM;

    const historyForAPI = [
      { role: 'system', content: sysPrompt },
      ...messages,
      userMsg
    ].map(m => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    let fullResponse = '';

    try {
      const resp = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: historyForAPI,
          stream: true,
          temperature: isPlan ? 0.3 : 0.7,
          max_tokens: -1
        }),
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      if (!resp.body) throw new Error('Empty response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith('data: ')) continue;
          const data = t.slice(6);
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content ?? '';
            if (token) {
              fullResponse += token;
              setMessages(prev => {
                const arr = [...prev];
                const last = arr[arr.length - 1];
                if (last?.role === 'assistant') arr[arr.length - 1] = { ...last, content: last.content + token };
                return arr;
              });
            }
          } catch {}
        }
      }

      if (isPlan && fullResponse) {
        const plan = parsePlanJSON(fullResponse);
        if (plan) {
          const result = await (window as any).api?.createRepoFromPlan(plan.name, plan.files);
          const statusMsg = result?.success
            ? `\n\n---\n**Repository created:** \`${result.name}\` with ${plan.files.length} files.\nNavigate to Repositories to view it.`
            : `\n\n---\n**Failed to create repository:** ${result?.message}`;
          setMessages(prev => {
            const arr = [...prev];
            const last = arr[arr.length - 1];
            if (last?.role === 'assistant') arr[arr.length - 1] = { ...last, content: last.content + statusMsg };
            return arr;
          });
        }
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(`Connection failed: ${err.message}`);
      }
      setMessages(prev => {
        const arr = [...prev];
        const last = arr[arr.length - 1];
        if (last?.role === 'assistant' && !last.content) arr.pop();
        return arr;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages]);

  return (
    <AIContext.Provider value={{ messages, setMessages, input, setInput, isStreaming, error, sendMessage, stopGeneration, clearChat }}>
      {children}
    </AIContext.Provider>
  );
}

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
};
