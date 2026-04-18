import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITBOT_DIR = path.join(os.homedir(), '.gitbot');
const CONFIG_FILE = path.join(GITBOT_DIR, 'config.json');
const REPOS_DIR = path.join(GITBOT_DIR, 'repos');
const PROFILE_IMAGE = path.join(GITBOT_DIR, 'profile.png');

let aiProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

// Ensure directories exist
for (const d of [GITBOT_DIR, REPOS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ─── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#0d1117', show: false,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: false
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'gitbot-repo', privileges: { bypassCSP: true, supportFetchAPI: true, standard: true, secure: true } },
  { scheme: 'gitbot-profile', privileges: { bypassCSP: true, supportFetchAPI: true, standard: true, secure: true } }
]);

app.whenReady().then(() => {
  protocol.registerFileProtocol('gitbot-repo', (request, callback) => {
    const url = decodeURIComponent(request.url.replace('gitbot-repo://', ''));
    try { callback(path.join(REPOS_DIR, url)); } catch { callback({ error: -6 }); }
  });
  protocol.registerFileProtocol('gitbot-profile', (request, callback) => {
    let url = decodeURIComponent(request.url.replace('gitbot-profile://', ''));
    if (url.match(/^[a-zA-Z]\//)) url = url.charAt(0) + ':' + url.substring(1);
    try { callback(url); } catch { callback({ error: -6 }); }
  });

  createWindow();
  
  // Defer AI startup by 2.5 seconds so the UI can load instantly
  setTimeout(() => {
    const aiPath = path.join(os.homedir(), 'Documents/github/gitbot/cpp/gemma-4-E2B-it-Q4_K_M.gguf');
    if (fs.existsSync(aiPath)) {
      console.log('Auto-starting AI...');
      const serverExe = app.isPackaged
        ? path.join(process.resourcesPath, 'cpp', 'llama-server.exe')
        : path.join(__dirname, '../cpp', 'llama-server.exe');
      if (fs.existsSync(serverExe)) {
        aiProcess = spawn(serverExe, [
          '-m', aiPath, '--port', '8080', '--ctx-size', '8192', '--n-predict', '-1', '--parallel', '1', '--threads', '4'
        ], { detached: true });
        aiProcess.on('error', () => {});
        aiProcess.unref();
      }
    }
  }, 2500);

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (aiProcess) aiProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// ─── Window controls ─────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('win-close', () => mainWindow?.close());

// ─── Settings ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-settings', async () => {
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  return {
    theme: 'dark', profileName: 'YASSER-27', profileImage: '',
    country: 'Unknown', bio: '',
    systemPrompt: 'You are a professional coding assistant. Provide clear, accurate, and concise answers.',
    promptTemplates: []
  };
});
ipcMain.handle('save-settings', async (_, s) => {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2));
  return true;
});

// Profile image upload
ipcMain.handle('upload-profile-image', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Profile Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null;
  const dest = path.join(GITBOT_DIR, 'profile' + path.extname(filePaths[0]));
  fs.copyFileSync(filePaths[0], dest);
  return 'gitbot-profile://' + dest; // Custom protocol marker
});

// Storage usage
ipcMain.handle('get-storage-usage', async () => {
  let size = 0;
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, item.name);
      if (item.isDirectory()) scan(p);
      else size += fs.statSync(p).size;
    }
  };
  scan(REPOS_DIR);
  return size; // bytes
});

// ─── Repositories ─────────────────────────────────────────────────────────────
ipcMain.handle('get-repos', async () => {
  if (!fs.existsSync(REPOS_DIR)) return [];
  return fs.readdirSync(REPOS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
});

ipcMain.handle('create-repo', async (_, name: string) => {
  const p = path.join(REPOS_DIR, name);
  if (fs.existsSync(p)) return false;
  fs.mkdirSync(p, { recursive: true });
  // Initialize commit ledger
  fs.writeFileSync(path.join(p, '.gitbot-commits.json'), JSON.stringify([], null, 2));
  return true;
});

ipcMain.handle('delete-repo', async (_, name: string) => {
  const p = path.join(REPOS_DIR, name);
  if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); return true; }
  return false;
});

ipcMain.handle('rename-repo', async (_, oldName: string, newName: string) => {
  const oldPath = path.join(REPOS_DIR, oldName);
  const newPath = path.join(REPOS_DIR, newName);
  if (!fs.existsSync(oldPath)) return { ok: false, message: 'Repository not found' };
  if (fs.existsSync(newPath)) return { ok: false, message: 'A repository with that name already exists' };
  fs.renameSync(oldPath, newPath);
  return { ok: true };
});

ipcMain.handle('toggle-star', async (_, name: string) => {
  const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
  const stars: string[] = cfg.stars || [];
  const idx = stars.indexOf(name);
  if (idx >= 0) stars.splice(idx, 1); else stars.push(name);
  cfg.stars = stars;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  return stars;
});

ipcMain.handle('get-stars', async () => {
  const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) : {};
  return cfg.stars || [];
});

// ─── Advanced File Operations ──────────────────────────────────────────────────
const recursiveScan = (dir: string, base = ''): any[] => {
  const results: any[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === '.gitbot-commits.json') continue;
    const relPath = (base ? base + '/' + item.name : item.name);
    const fullPath = path.join(dir, item.name);
    const stats = fs.statSync(fullPath);
    results.push({ name: item.name, path: relPath, isDirectory: item.isDirectory(), size: stats.size, date: stats.mtime.toLocaleDateString() });
  }
  return results.sort((a, b) => (b.isDirectory ? 1 : 0) - (a.isDirectory ? 1 : 0) || a.name.localeCompare(b.name));
};

ipcMain.handle('get-repo-files', async (_, name: string, subPath = '') => {
  const p = path.join(REPOS_DIR, name, subPath);
  return recursiveScan(p, subPath);
});

ipcMain.handle('get-file-content', async (_, repoName: string, filePath: string) => {
  const p = path.join(REPOS_DIR, repoName, filePath);
  if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) return fs.readFileSync(p, 'utf8');
  return null;
});

ipcMain.handle('open-file', async (_, repoName: string, filePath: string) => {
  const p = path.join(REPOS_DIR, repoName, filePath);
  if (fs.existsSync(p)) { shell.openPath(p); return true; }
  return false;
});

ipcMain.handle('get-readme', async (_, name: string) => {
  const repoPath = path.join(REPOS_DIR, name);
  if (!fs.existsSync(repoPath)) return null;

  let found = '';
  const searchReadme = (dir: string, depth: number) => {
    if (depth > 2 || found) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.toLowerCase() === 'readme.md' || item.name.toLowerCase() === 'readme') {
          found = path.join(dir, item.name);
          return;
        } else if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          searchReadme(path.join(dir, item.name), depth + 1);
        }
      }
    } catch {}
  };
  searchReadme(repoPath, 0);

  if (found) return fs.readFileSync(found, 'utf8');
  return null;
});

ipcMain.handle('get-language-stats', async (_, name: string) => {
  const p = path.join(REPOS_DIR, name);
  const stats: Record<string, { size: number; files: string[] }> = {};
  const scan = (dir: string, base = '') => {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.gitbot-commits.json'].includes(item.name)) continue;
      const full = path.join(dir, item.name);
      const rel = base ? base + '/' + item.name : item.name;
      if (item.isDirectory()) scan(full, rel);
      else {
        const ext = path.extname(item.name).toLowerCase();
        if (ext) {
          if (!stats[ext]) stats[ext] = { size: 0, files: [] };
          stats[ext].size += fs.statSync(full).size;
          stats[ext].files.push(rel);
        }
      }
    }
  };
  scan(p);
  return stats;
});

const copyRecursiveSync = (src: string, dest: string) => {
  if (!fs.existsSync(src)) return;
  const s = fs.statSync(src);
  if (s.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src))
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
  } else {
    fs.copyFileSync(src, dest);
  }
};

ipcMain.handle('upload-file', async (_, repoName: string) => {
  const repoPath = path.join(REPOS_DIR, repoName);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Upload to Project',
    properties: ['openFile', 'openDirectory', 'multiSelections']
  });
  if (canceled || filePaths.length === 0) return { ok: false, files: [] };
  const fileList: string[] = [];
  for (const p of filePaths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(p)) {
        copyRecursiveSync(path.join(p, child), path.join(repoPath, child));
      }
    } else {
      const dest = path.join(repoPath, path.basename(p));
      copyRecursiveSync(p, dest);
    }
    // Collect all files within the path
    const collectFiles = (src: string, base: string) => {
      const s = fs.statSync(src);
      if (s.isDirectory()) {
        for (const child of fs.readdirSync(src))
          collectFiles(path.join(src, child), base + '/' + child);
      } else fileList.push(path.basename(base));
    };
    collectFiles(p, path.basename(p));
  }
  return { ok: true, files: fileList };
});

ipcMain.handle('download-repo', async (_, name: string) => {
  const p = path.join(REPOS_DIR, name);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Download Project', defaultPath: `${name}.zip`,
    filters: [{ name: 'Zip Files', extensions: ['zip'] }]
  });
  if (canceled || !filePath) return { success: false };
  return new Promise(resolve => {
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve({ success: true }));
    archive.on('error', err => resolve({ success: false, message: err.message }));
    archive.pipe(output);
    archive.directory(p, false);
    archive.finalize();
  });
});

// ─── Commits ──────────────────────────────────────────────────────────────────
ipcMain.handle('get-commits', async (_, name: string) => {
  const ledger = path.join(REPOS_DIR, name, '.gitbot-commits.json');
  if (!fs.existsSync(ledger)) return [];
  return JSON.parse(fs.readFileSync(ledger, 'utf-8'));
});

ipcMain.handle('create-commit', async (_, name: string, message: string) => {
  const repoPath = path.join(REPOS_DIR, name);
  const ledger = path.join(repoPath, '.gitbot-commits.json');
  const commits: any[] = fs.existsSync(ledger) ? JSON.parse(fs.readFileSync(ledger, 'utf-8')) : [];
  const id = Date.now().toString(36);
  
  // Create snapshot ZIP
  const gitbotDir = path.join(repoPath, '.gitbot');
  if (!fs.existsSync(gitbotDir)) fs.mkdirSync(gitbotDir, { recursive: true });
  const snapshotZip = path.join(gitbotDir, `${id}.zip`);
  
  await new Promise(resolve => {
    const output = fs.createWriteStream(snapshotZip);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(true));
    archive.on('error', () => resolve(false));
    archive.pipe(output);
    archive.glob('**/*', { 
      cwd: repoPath, 
      ignore: ['.gitbot/**', 'node_modules/**', '.gitbot-commits.json', 'releases/**'] 
    });
    archive.finalize();
  });

  // Snapshot: store list of files
  const snapshot: string[] = [];
  const scan = (dir: string, base = '') => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name === '.gitbot-commits.json' || item.name === 'releases' || item.name === '.gitbot') continue;
      const rel = base ? base + '/' + item.name : item.name;
      if (item.isDirectory()) scan(path.join(dir, item.name), rel);
      else snapshot.push(rel);
    }
  };
  try { scan(repoPath); } catch {}
  commits.unshift({ id, message, date: new Date().toISOString(), files: snapshot });
  fs.writeFileSync(ledger, JSON.stringify(commits, null, 2));
  return { id, date: new Date().toISOString() };
});

ipcMain.handle('open-commit', async (_, name: string, id: string) => {
  const p = path.join(REPOS_DIR, name, '.gitbot', `${id}.zip`);
  if (fs.existsSync(p)) shell.showItemInFolder(p);
  return true;
});

// ─── Releases ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-releases', async (_, name: string) => {
  const relDir = path.join(REPOS_DIR, name, 'releases');
  if (!fs.existsSync(relDir)) return [];
  return fs.readdirSync(relDir, { withFileTypes: true })
    .filter(f => !f.isDirectory())
    .map(f => {
      const stat = fs.statSync(path.join(relDir, f.name));
      return { name: f.name, size: stat.size, date: stat.mtime.toISOString() };
    });
});

ipcMain.handle('upload-release', async (_, name: string) => {
  const relDir = path.join(REPOS_DIR, name, 'releases');
  if (!fs.existsSync(relDir)) fs.mkdirSync(relDir, { recursive: true });
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Upload Release Asset',
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || filePaths.length === 0) return false;
  for (const fp of filePaths)
    fs.copyFileSync(fp, path.join(relDir, path.basename(fp)));
  return true;
});

ipcMain.handle('open-release', async (_, name: string, filename: string) => {
  const p = path.join(REPOS_DIR, name, 'releases', filename);
  if (fs.existsSync(p)) shell.showItemInFolder(p);
  return true;
});

ipcMain.handle('delete-release', async (_, name: string, filename: string) => {
  const p = path.join(REPOS_DIR, name, 'releases', filename);
  if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  return false;
});

// ─── AI engine ────────────────────────────────────────────────────────────────
ipcMain.handle('start-ai', async (_, providedModelPath?: string) => {
  if (aiProcess) { aiProcess.kill(); aiProcess = null; }
  const modelPath = providedModelPath ||
    path.join(os.homedir(), 'Documents/github/gitbot/cpp/gemma-4-E2B-it-Q4_K_M.gguf');
  const serverExe = app.isPackaged
    ? path.join(process.resourcesPath, 'cpp', 'llama-server.exe')
    : path.join(__dirname, '../cpp', 'llama-server.exe');
  if (!fs.existsSync(serverExe)) return { success: false, message: 'Server not found' };
  if (!fs.existsSync(modelPath)) return { success: false, message: 'Model not found at ' + modelPath };
  aiProcess = spawn(serverExe, ['-m', modelPath, '--port', '8080', '--ctx-size', '8192', '--n-predict', '-1']);
  return new Promise(r => setTimeout(() => r({ success: !!aiProcess && !aiProcess!.killed }), 2000));
});

ipcMain.handle('stop-ai', async () => {
  if (aiProcess) { aiProcess.kill(); aiProcess = null; return true; }
  return false;
});

// Create files from AI plan (used by /plan command)
ipcMain.handle('create-repo-from-plan', async (_, repoName: string, files: { path: string; content: string }[]) => {
  let finalName = repoName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'ai-project';
  let repoPath = path.join(REPOS_DIR, finalName);
  
  if (fs.existsSync(repoPath)) {
    finalName = `${finalName}-${Date.now().toString().slice(-6)}`;
    repoPath = path.join(REPOS_DIR, finalName);
  }
  
  fs.mkdirSync(repoPath, { recursive: true });
  for (const f of files) {
    const fullPath = path.join(repoPath, f.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, f.content, 'utf-8');
  }
  // Initialize commit ledger
  const commits = [{ id: 'init', message: 'Initial commit (AI Generated)', date: new Date().toISOString(), files: files.map(f => f.path) }];
  fs.writeFileSync(path.join(repoPath, '.gitbot-commits.json'), JSON.stringify(commits, null, 2));
  return { success: true, name: finalName };
});
