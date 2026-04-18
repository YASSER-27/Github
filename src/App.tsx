import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Topbar from './components/Topbar';
import Profile from './pages/Profile';
import Repository from './pages/Repository';
import Settings from './pages/Settings';
import AIPanel from './pages/AIPanel';
import Templates from './pages/Templates';
import Pages from './pages/Pages';
import './App.css';

function App() {
  const [showIntro, setShowIntro] = useState(false);
  const [introFading, setIntroFading] = useState(false);

  useEffect(() => {
    if (window.api) {
      window.api.getSettings().then((s: any) => {
        if (s?.theme) document.documentElement.setAttribute('data-theme', s.theme);
        
        // Show intro if not disabled (default is true)
        if (s?.introEnabled !== false) {
          setShowIntro(true);
          setTimeout(() => setIntroFading(true), 2500); // Start fading out at 2.5s
          setTimeout(() => setShowIntro(false), 3000); // Remove completely at 3s
        }
      });
    }
  }, []);

  return (
    <div className="app-container">
      {showIntro && (
        <div className={`gitbot-intro-overlay ${introFading ? 'fade-out' : 'fade-in'}`}>
          <div className="intro-content">
            <div className="ai-circles-demo" style={{ transform: 'scale(1.5)', marginBottom: '30px' }}>
              <div className="ai-circle-multiple">
                <div className="ai-circle"></div>
                <div className="ai-circle"></div>
                <div className="ai-circle"></div>
              </div>
            </div>
            <h1 className="intro-title">Gitbot Ai Copilot</h1>
            <h2 className="intro-subtitle">Gitbot</h2>
            <p className="intro-author">Yasser27</p>
          </div>
        </div>
      )}
      <Topbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/repo/:name" element={<Repository />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai" element={<AIPanel />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/pages" element={<Pages />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
