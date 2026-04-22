import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Book, Users, MapPin, Building, Star, Trash2, Plus } from 'lucide-react';
import gitbotLogo from '../assets/gitbot.png';
import Markdown from '../components/Markdown';
import './Profile.css';

interface Settings {
  theme: string;
  profileName: string;
  profileImage: string;
  country: string;
  bio?: string;
  followers?: number;
  following?: number;
}

export default function Profile() {
  const [settings, setSettings] = useState<Settings>({
    theme: 'github-dark',
    profileName: 'Developer',
    profileImage: '',
    country: 'Unknown',
    bio: 'Local software engineer using GitFusion X.',
  });
  const [repos, setRepos] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [stars, setStars] = useState<string[]>([]);
  const [aboutMap, setAboutMap] = useState<Record<string, string>>({});
  const [profileReadme, setProfileReadme] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadRepos = async () => {
    if (window.api) {
      const r = await window.api.getRepos();
      setRepos(r);
    }
  };

  const loadStars = async () => {
    if ((window as any).api) {
      const s = await ((window as any).api as any).getStars();
      setStars(s || []);
    }
  };

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'repos' || tab === 'repositories') setActiveTab('repos');
  }, [searchParams]);

  useEffect(() => {
    if (window.api) {
      window.api.getSettings().then((s: any) => {
        setSettings(prev => ({ ...prev, ...s }));
        setAboutMap(s?.repoAbout || {});
      });
      loadRepos();
      loadStars();
    } else {
      setRepos(['gitbot', 'react-project', 'test-app']);
    }
  }, []);

  useEffect(() => {
    if (window.api) {
      // Improved matching: Check for display name OR slugified version (no spaces)
      const profileSlug = settings.profileName.toLowerCase().replace(/\s+/g, '');
      const specialRepo = repos.find(r =>
        r.toLowerCase() === settings.profileName.toLowerCase() ||
        r.toLowerCase() === profileSlug
      );

      if (specialRepo) {
        window.api.getReadme(specialRepo).then(content => {
          setProfileReadme(content || '');
        });
      } else {
        setProfileReadme('');
      }
    } else {
      setProfileReadme('');
    }
  }, [repos, settings.profileName]);


  const handleDelete = async (repo: string) => {
    if (!window.confirm(`Delete repository "${repo}"? This cannot be undone.`)) return;
    if (window.api) { await window.api.deleteRepo(repo); loadRepos(); loadStars(); }
  };

  const handleToggleStar = async (repo: string) => {
    if ((window as any).api) {
      const s = await ((window as any).api as any).toggleStar(repo);
      setStars(s);
    }
  };

  return (
    <div className="profile-layout fade-in">
      {/* ── Sidebar ── */}
      <aside className="profile-sidebar">
        <div className="profile-avatar-wrap">
          <img
            src={settings.profileImage || gitbotLogo}
            alt="Avatar"
            className="profile-avatar-large"
            onError={e => { (e.target as HTMLImageElement).src = gitbotLogo; }}
          />
        </div>

        <h1 className="profile-name">{settings.profileName}</h1>
        <h2 className="profile-username">{settings.profileName.toLowerCase().replace(/\s+/g, '')}</h2>
        <p className="profile-bio">{settings.bio}</p>

        <Link to="/settings" className="button profile-edit-btn">Edit profile</Link>

        <div className="profile-details">
          <div className="profile-detail-item">
            <Users size={16} />
            <span><b>{settings.followers || 0}</b> followers · <b>{settings.following || 0}</b> following</span>
          </div>
          <div className="profile-detail-item">
            <MapPin size={16} />
            <span>{settings.country}</span>
          </div>
          <div className="profile-detail-item">
            <Building size={16} />
            <span>GitFusion X</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="profile-main">
        <nav className="profile-tabs">
          <div className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Book size={16} /> Overview
          </div>
          <div className={`profile-tab ${activeTab === 'repos' ? 'active' : ''}`} onClick={() => setActiveTab('repos')}>
            <Book size={16} /> Repositories
            <span className="count-badge">{repos.length}</span>
          </div>
        </nav>

        {activeTab === 'overview' && (
          <div className="fade-in">
            {profileReadme && (
              <div style={{ marginBottom: '24px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {settings.profileName} / README.md
                </span>
                <div style={{ marginTop: '12px' }}>
                  <Markdown content={profileReadme} repoName={settings.profileName} />
                </div>
              </div>
            )}
            <div className="pinned-header">{stars.length > 0 ? 'Starred repositories' : 'Your repositories'}</div>
            {repos.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: '24px 0' }}>
                No repositories yet. Click <b>+</b> in the top bar or switch to the Repositories tab to create one.
              </div>
            ) : (
              <div className="pinned-grid">
                {(stars.length > 0 ? stars.filter(r => repos.includes(r)) : repos.slice(0, 6)).map(repo => (
                  <div key={repo} className="repo-card">
                    <div className="repo-card-title">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Book size={16} color="var(--text-secondary)" />
                        <Link to={`/repo/${repo}`}>{repo}</Link>
                      </span>
                      <span className="badge">Public</span>
                    </div>
                    <div className="repo-card-desc">Locally managed repository.</div>
                    <div className="repo-card-meta">
                      <span><span className="lang-dot" style={{ backgroundColor: '#3178c6' }} />Local</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        onClick={() => handleToggleStar(repo)}>
                        <Star size={13} fill={stars.includes(repo) ? "var(--accent-color)" : "none"} color={stars.includes(repo) ? "var(--accent-color)" : "var(--text-secondary)"} />
                        {stars.includes(repo) ? 1 : 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'repos' && (
          <div className="fade-in">
            <div className="repos-toolbar" style={{ justifyContent: 'space-between' }}>
              <div className="repo-search-container">
                <input 
                  type="text" 
                  className="input repo-search-input" 
                  placeholder="Find a repository..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="button button-primary" onClick={() => window.dispatchEvent(new CustomEvent('open-new-repo'))}>
                <Plus size={15} /> New
              </button>
            </div>

            {repos.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', padding: '32px 0', textAlign: 'center' }}>
                No repositories yet. Type a name above and click New.
              </div>
            )}

            {repos.filter(r => r.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && searchQuery && (
              <div style={{ color: 'var(--text-secondary)', padding: '32px 0', textAlign: 'center' }}>
                No repositories matching "<b>{searchQuery}</b>" found.
              </div>
            )}

            {repos
              .filter(r => r.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(repo => (
                <div key={repo} className="repo-list-item">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <Link to={`/repo/${repo}`} className="repo-list-name">{repo}</Link>
                      <span className="badge">Public</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      {aboutMap[repo] || 'A locally managed gitbot repository'}
                    </p>
                    <div className="repo-card-meta">
                      <span><span className="lang-dot" style={{ backgroundColor: '#2b7489' }} />TypeScript</span>
                      <span>Updated recently</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flex: 'none' }}>
                    <button className="button" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: stars.includes(repo) ? 'var(--accent-color)' : '' }} onClick={() => handleToggleStar(repo)}>
                      <Star size={14} fill={stars.includes(repo) ? 'currentColor' : 'none'} />
                      {stars.includes(repo) ? 'Starred' : 'Star'}
                    </button>
                    <button className="button button-danger" onClick={() => handleDelete(repo)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>

    </div>
  );
}
