import { app, BrowserWindow, ipcMain, dialog, shell, protocol, Tray, Menu, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { spawn, execSync, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Workspace configuration
let GITBOT_DIR = path.join(os.homedir(), '.gitbot');
const WORKSPACE_FILE = path.join(os.homedir(), '.gitbot', 'workspace.txt');
let customWorkspacePath: string | null = null;
if (fs.existsSync(WORKSPACE_FILE)) {
  const custom = fs.readFileSync(WORKSPACE_FILE, 'utf-8').trim();
  if (custom && fs.existsSync(custom)) {
    GITBOT_DIR = custom;
    customWorkspacePath = custom;
  }
}

let CONFIG_FILE = path.join(GITBOT_DIR, 'config.json');
let REPOS_DIR = path.join(GITBOT_DIR, 'repos');
let MODELS_DIR = path.join(GITBOT_DIR, 'models');
let PROFILE_IMAGE = path.join(GITBOT_DIR, 'profile.png');

let aiProcess: ChildProcess | null = null;
let lastAiError: string | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function killAIProcess() {
  try {
    // Force-kill all llama-server instances to release DLL file locks
    execSync('taskkill /F /IM llama-server.exe /T', { stdio: 'ignore' });
  } catch {}
  try {
    if (aiProcess) { 
      // Smart: remove listeners to avoid spurious logs during intentional kill
      aiProcess.removeAllListeners('exit');
      aiProcess.kill('SIGKILL'); 
      aiProcess = null; 
    }
  } catch {}
}


// Ensure base directories exist
if (!fs.existsSync(path.join(os.homedir(), '.gitbot'))) fs.mkdirSync(path.join(os.homedir(), '.gitbot'), { recursive: true });
for (const d of [GITBOT_DIR, REPOS_DIR, MODELS_DIR]) {
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
  
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  // Prevent closing the app (minimize to tray)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

// Global flag to track genuine quit request (unused on app object, now using local variable)
// protocol registration...

protocol.registerSchemesAsPrivileged([
  { scheme: 'gitbot-repo', privileges: { bypassCSP: true, supportFetchAPI: true, standard: true, secure: true, corsEnabled: true, allowServiceWorkers: true } },
  { scheme: 'gitbot-profile', privileges: { bypassCSP: true, supportFetchAPI: true, standard: true, secure: true, corsEnabled: true } }
]);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
  protocol.registerFileProtocol('gitbot-repo', (request, callback) => {
    try {
      // Robust path extraction that handles both gitbot-repo://local/RepoName and gitbot-repo://RepoName
      let urlPath = request.url.replace('gitbot-repo://local/', '').replace('gitbot-repo://', '');
      
      const decoded = decodeURIComponent(urlPath);
      const fullPath = path.join(REPOS_DIR, decoded);
      callback({ path: fullPath });
    } catch { callback({ error: -6 }); }
  });
  protocol.registerFileProtocol('gitbot-profile', (request, callback) => {
    let url = decodeURIComponent(request.url.replace('gitbot-profile://', ''));
    if (url.match(/^[a-zA-Z]\//)) url = url.charAt(0) + ':' + url.substring(1);
    try { callback(url); } catch { callback({ error: -6 }); }
  });

  createWindow();
  
  setTimeout(() => {
    let configObj: any = {};
    try { if (fs.existsSync(CONFIG_FILE)) configObj = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch {}
    
    let aiModel = configObj.aiModels?.find((m: any) => m.isActive);
    let aiPath = aiModel?.modelPath || configObj.lastModelPath;
    let mmprojPath = aiModel?.mmprojPath || configObj.lastMmprojPath;

    if (!aiPath || !fs.existsSync(aiPath)) {
      aiPath = app.isPackaged
        ? path.join(process.resourcesPath, 'cpp', 'gemma-4-E2B-it-Q4_K_M.gguf')
        : path.join(__dirname, '../cpp', 'gemma-4-E2B-it-Q4_K_M.gguf');
    }
    
    if (fs.existsSync(aiPath)) {
      console.log('Auto-starting AI...');
      const serverExe = app.isPackaged
        ? path.join(process.resourcesPath, 'cpp', 'llama-server.exe')
        : path.join(__dirname, '../cpp', 'llama-server.exe');
      if (fs.existsSync(serverExe)) {
        const args = [
          '-m', aiPath, 
          '--port', '8080', 
          '--ctx-size', '8192', 
          '--n-predict', '-1',
          '--threads', Math.max(1, os.cpus().length - 2).toString(),
          '--parallel', '1',
          '--batch-size', '512'
        ];
        if (mmprojPath && fs.existsSync(mmprojPath)) {
          args.push('--mmproj', mmprojPath);
        }

        aiProcess = spawn(serverExe, args, { detached: true });
        aiProcess.on('error', () => {});
        aiProcess.stdout?.on('data', d => console.log(`[AI] ${d}`));
        aiProcess.stderr?.on('data', d => console.error(`[AI ERR] ${d}`));
        aiProcess.on('exit', code => console.log(`[AI Exit] code ${code}`));
        aiProcess.unref();
      }
    }
  }, 2500);

  // Setup System Tray
  const iconPath = app.isPackaged ? path.join(process.resourcesPath, 'assets', 'icon.ico') : path.join(__dirname, '../assets/icon.ico');
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Gitbot', click: () => mainWindow?.show() },
      { label: 'Hide Gitbot', click: () => mainWindow?.hide() },
      { type: 'separator' },
      { label: 'Quit', click: () => { isQuitting = true; killAIProcess(); app.quit(); } }
    ]);
    tray.setToolTip('Gitbot AI Manager');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      mainWindow?.isVisible() ? mainWindow?.hide() : mainWindow?.show();
    });
  }

  // F9 Global Shortcut
  globalShortcut.register('F9', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else mainWindow?.show(); });
});
}

app.on('before-quit', () => { isQuitting = true; killAIProcess(); });

app.on('window-all-closed', () => {
  killAIProcess();
  if (process.platform !== 'darwin') app.quit();
});

// ─── Window controls ─────────────────────────────────────────────────────────
 // ─── Window controls ─────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('win-close', () => mainWindow?.hide());

// ─── Settings ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-settings', async () => {
  let settings: any = {
    theme: 'dark', profileName: 'YASSER-27', profileImage: '',
    country: 'Unknown', bio: '',
    systemPrompt: 'You are a professional coding assistant. Provide clear, accurate, and concise answers.',
    promptTemplates: [],
    aiModels: []
  };
  if (fs.existsSync(CONFIG_FILE)) {
    try { settings = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch(e) {}
  }
  settings.customWorkspace = customWorkspacePath;
  return settings;
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

ipcMain.handle('get-repo-about', async (_, name: string) => {
  const aboutFile = path.join(REPOS_DIR, name, '.gitbot-about.txt');
  if (fs.existsSync(aboutFile)) return fs.readFileSync(aboutFile, 'utf8').trim();
  return '';
});

ipcMain.handle('save-repo-about', async (_, name: string, about: string) => {
  const aboutFile = path.join(REPOS_DIR, name, '.gitbot-about.txt');
  fs.writeFileSync(aboutFile, about, 'utf8');
  return true;
});

ipcMain.handle('save-file-content', async (_, repoName: string, filePath: string, content: string) => {
  const p = path.join(REPOS_DIR, repoName, filePath);
  if (!fs.existsSync(p)) return false;
  fs.writeFileSync(p, content, 'utf8');
  return true;
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

ipcMain.handle('pick-model-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select AI Model File (.gguf)',
    filters: [
      { name: 'GGUF Models', extensions: ['gguf'] }
    ],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('pick-mmproj-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Vision Projector File (.gguf)',
    filters: [
      { name: 'Multimodal Projectors', extensions: ['gguf', 'bin'] }
    ],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('copy-ai-model', async (event, sourcePath: string) => {
  if (!fs.existsSync(sourcePath)) return { success: false, message: 'Source not found' };
  const fileName = path.basename(sourcePath);
  const destPath = path.join(MODELS_DIR, fileName);
  if (path.resolve(sourcePath) === path.resolve(destPath)) return { success: true, destPath };
  if (fs.existsSync(destPath)) return { success: true, destPath };
  const stats = fs.statSync(sourcePath);
  const totalSize = stats.size;
  let copiedSize = 0;
  return new Promise((resolve) => {
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(destPath);
    readStream.on('data', (chunk) => {
      copiedSize += chunk.length;
      const percent = Math.round((copiedSize / totalSize) * 100);
      event.sender.send('copy-progress', { fileName, percent });
    });
    writeStream.on('finish', () => resolve({ success: true, destPath }));
    writeStream.on('error', (err: any) => resolve({ success: false, message: err.message }));
    readStream.pipe(writeStream);
  });
});

ipcMain.handle('delete-model-file', async (_, filePath: string) => {
  if (filePath && filePath.startsWith(MODELS_DIR) && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); return true; } catch { return false; }
  }
  return false;
});

ipcMain.handle('pick-skill-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Skill Files or Folders',
    filters: [
      { name: 'Documents', extensions: ['md', 'txt', 'js', 'ts', 'py', 'json', 'css', 'html'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || filePaths.length === 0) return null;
  
  const results = [];
  for (const p of filePaths) {
    if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
      results.push({
        name: path.basename(p),
        path: p,
        content: fs.readFileSync(p, 'utf-8')
      });
    }
  }
  return results;
});

ipcMain.handle('change-workspace', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select New Global Storage Location',
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || filePaths.length === 0) return false;
  const newPath = filePaths[0];
  const pointerFile = path.join(os.homedir(), '.gitbot', 'workspace.txt');
  fs.writeFileSync(pointerFile, newPath, 'utf-8');
  // Initialize minimal structure to prevent crashes before reloads
  if (!fs.existsSync(path.join(newPath, 'repos'))) {
    fs.mkdirSync(path.join(newPath, 'repos'), { recursive: true });
  }
  return true;
});

ipcMain.handle('change-workspace-default', async () => {
  const pointerFile = path.join(os.homedir(), '.gitbot', 'workspace.txt');
  if (fs.existsSync(pointerFile)) fs.unlinkSync(pointerFile);
  return true;
});

ipcMain.handle('export-multi-repos', async (_, repos: string[]) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Selected Repositories',
    defaultPath: `Gitbot-Backup-${Date.now()}.zip`,
    filters: [{ name: 'Zip Archives', extensions: ['zip'] }]
  });
  if (canceled || !filePath) return false;
  return new Promise((resolve) => {
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(true));
    archive.on('error', () => resolve(false));
    archive.pipe(output);
    for (const repo of repos) {
      const p = path.join(REPOS_DIR, repo);
      if (fs.existsSync(p)) archive.directory(p, repo);
    }
    archive.finalize();
  });
});

ipcMain.handle('upload-file', async (_, repoName: string) => {
  const repoPath = path.join(REPOS_DIR, repoName);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Upload to Project',
    properties: ['openFile', 'openDirectory', 'multiSelections']
  });
  if (canceled || filePaths.length === 0) return { ok: false, files: [] };

  // Folders that should NEVER be copied (heavy/transient)
  const SKIP_DIRS = new Set([
    'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out',
    '__pycache__', '.venv', 'venv', 'env', '.env', '.next', '.nuxt',
    '.cache', 'vendor', 'bower_components', 'packages', '.dart_tool',
    'target', 'bin', 'obj', 'Pods', '.gradle', '.idea', '.vs', '.vscode',
    'coverage', '.nyc_output', 'tmp', 'temp',  '.turbo', '.vercel'
  ]);

  const smartCopy = (src: string, dest: string) => {
    const s = fs.statSync(src);
    if (s.isDirectory()) {
      const dirName = path.basename(src);
      if (SKIP_DIRS.has(dirName)) return; // skip heavy dirs
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const child of fs.readdirSync(src))
        smartCopy(path.join(src, child), path.join(dest, child));
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  const collected: string[] = [];
  const collectFiles = (dir: string, base: string) => {
    const s = fs.statSync(dir);
    if (s.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(dir))) return;
      for (const child of fs.readdirSync(dir))
        collectFiles(path.join(dir, child), base + '/' + child);
    } else {
      collected.push(path.basename(base));
    }
  };

  for (const p of filePaths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(p))
        smartCopy(path.join(p, child), path.join(repoPath, child));
    } else {
      smartCopy(p, path.join(repoPath, path.basename(p)));
    }
    collectFiles(p, path.basename(p));
  }
  return { ok: true, files: collected };
});

ipcMain.handle('open-in-powershell', async (_, repoName: string) => {
  const repoPath = path.join(REPOS_DIR, repoName);
  if (!fs.existsSync(repoPath)) return false;
  // Use start powershell specifically for better window opening on Windows
  spawn('cmd.exe', ['/c', 'start', 'powershell.exe', '-NoExit', '-Command', `Set-Location -LiteralPath "${repoPath}"`], {
    detached: true, stdio: 'ignore'
  }).unref();
  return true;
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
ipcMain.handle('start-ai', async (_, providedModelPath?: string, providedMmprojPath?: string) => {
  // if (aiProcess) { aiProcess.kill(); aiProcess = null; }
  killAIProcess(); // Robustly kill previous processes to release file locks (Smart Connection)
  
  // Smart Grace Period: Wait for OS to release Port 8080 and file locks
  await new Promise(r => setTimeout(r, 1500));


  
  let configObj: any = {};
  try { if (fs.existsSync(CONFIG_FILE)) configObj = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch {}

  const modelPath = providedModelPath || configObj.lastModelPath || (
    app.isPackaged
      ? path.join(process.resourcesPath, 'cpp', 'gemma-4-E2B-it-Q4_K_M.gguf')
      : path.join(__dirname, '../cpp', 'gemma-4-E2B-it-Q4_K_M.gguf')
  );
  
  // Only use lastMmprojPath if we are auto-starting (no paths provided)
  // If providedModelPath is given, we should only use providedMmprojPath (which might be null)
  const mmprojPath = (providedModelPath || providedMmprojPath !== undefined)
    ? (providedMmprojPath || null)
    : (configObj.lastMmprojPath || null);
  
  const serverExe = app.isPackaged
    ? path.join(process.resourcesPath, 'cpp', 'llama-server.exe')
    : path.join(__dirname, '../cpp', 'llama-server.exe');
  if (!fs.existsSync(serverExe)) return { success: false, message: 'Server not found' };
  if (!fs.existsSync(modelPath)) return { success: false, message: 'Model not found at ' + modelPath };
  
  const isVision = !!(mmprojPath && fs.existsSync(mmprojPath));
  
  const args = [
    '-m', modelPath, 
    '--port', '8080', 
    '--ctx-size', isVision ? '8192' : '16384', 
    '--n-predict', '4096',
    '--threads', Math.max(1, os.cpus().length - 1).toString(),
    '--threads-batch', os.cpus().length.toString(),
    '--parallel', '1',
    '--batch-size', '2048',
    '--flash-attn', 'auto'
  ];

  if (isVision) {
    args.push('--mmproj', mmprojPath as string);
    // Smart: Add recommended vision tokens for better accuracy
    args.push('--image-min-tokens', '1024'); 
  }

  
  aiProcess = spawn(serverExe, args, { detached: true });

  lastAiError = null; // Reset error on new start
  
  aiProcess.stdout?.on('data', d => console.log(`[AI] ${d}`));
  aiProcess.stderr?.on('data', d => {
    const msg = d.toString();
    console.error(`[AI ERR] ${msg}`);
    // Capture critical error messages for frontend
    if (msg.includes('error:') || msg.includes('failed') || msg.includes('mismatch')) {
      lastAiError = msg;
    }
  });
  aiProcess.on('exit', code => {
    if (code !== null && code !== 0) {
      console.log(`[AI Exit] code ${code}`);
    }
  });
  
  if (providedModelPath) configObj.lastModelPath = providedModelPath;
  if (providedMmprojPath) configObj.lastMmprojPath = providedMmprojPath;
  else if (!providedModelPath && !providedMmprojPath && mmprojPath) configObj.lastMmprojPath = mmprojPath;
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configObj, null, 2));
  return { success: true };
});

ipcMain.handle('stop-ai', async () => {
  // if (aiProcess) { aiProcess.kill(); aiProcess = null; return true; }
  killAIProcess(); // Ensure complete cleanup
  return true;
});

ipcMain.handle('ping-ai', async () => {
  try {
    const res = await fetch('http://127.0.0.1:8080/v1/models');
    return res.ok;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('get-ai-error', async () => {
  return lastAiError;
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
