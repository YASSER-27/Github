import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s: any) => ipcRenderer.invoke('save-settings', s),
  uploadProfileImage: () => ipcRenderer.invoke('upload-profile-image'),
  getStorageUsage: () => ipcRenderer.invoke('get-storage-usage'),
   pickModelFile: () => ipcRenderer.invoke('pick-model-file'),
  pickMmprojFile: () => ipcRenderer.invoke('pick-mmproj-file'),
  pickSkillFiles: () => ipcRenderer.invoke('pick-skill-files'),
  changeWorkspace: () => ipcRenderer.invoke('change-workspace'),
  changeWorkspaceDefault: () => ipcRenderer.invoke('change-workspace-default'),
  exportMultiRepos: (repos: string[]) => ipcRenderer.invoke('export-multi-repos', repos),

  // Repos
  getRepos: () => ipcRenderer.invoke('get-repos'),
  createRepo: (name: string) => ipcRenderer.invoke('create-repo', name),
  deleteRepo: (name: string) => ipcRenderer.invoke('delete-repo', name),
  renameRepo: (oldName: string, newName: string) => ipcRenderer.invoke('rename-repo', oldName, newName),
  downloadRepo: (name: string) => ipcRenderer.invoke('download-repo', name),

  // Stars
  toggleStar: (name: string) => ipcRenderer.invoke('toggle-star', name),
  getStars: () => ipcRenderer.invoke('get-stars'),

  // Files
  getRepoFiles: (name: string, subPath = '') => ipcRenderer.invoke('get-repo-files', name, subPath),
  getFileContent: (name: string, filePath: string) => ipcRenderer.invoke('get-file-content', name, filePath),
  saveFileContent: (name: string, filePath: string, content: string) => ipcRenderer.invoke('save-file-content', name, filePath, content),
  openFile: (name: string, filePath: string) => ipcRenderer.invoke('open-file', name, filePath),
  getReadme: (name: string) => ipcRenderer.invoke('get-readme', name),
  getLanguageStats: (name: string) => ipcRenderer.invoke('get-language-stats', name),
  uploadFile: (name: string) => ipcRenderer.invoke('upload-file', name),
  getRepoAbout: (name: string) => ipcRenderer.invoke('get-repo-about', name),
  saveRepoAbout: (name: string, about: string) => ipcRenderer.invoke('save-repo-about', name, about),
  openInPowershell: (name: string) => ipcRenderer.invoke('open-in-powershell', name),

  // Commits
  getCommits: (name: string) => ipcRenderer.invoke('get-commits', name),
  createCommit: (name: string, message: string) => ipcRenderer.invoke('create-commit', name, message),
  openCommit: (name: string, id: string) => ipcRenderer.invoke('open-commit', name, id),

  // Releases
  getReleases: (name: string) => ipcRenderer.invoke('get-releases', name),
  uploadRelease: (name: string) => ipcRenderer.invoke('upload-release', name),
  openRelease: (name: string, filename: string) => ipcRenderer.invoke('open-release', name, filename),
  deleteRelease: (name: string, filename: string) => ipcRenderer.invoke('delete-release', name, filename),

  // AI Plan
  createRepoFromPlan: (name: string, files: any[]) => ipcRenderer.invoke('create-repo-from-plan', name, files),

  // AI Engine
  startAI: (modelPath?: string, mmprojPath?: string) => ipcRenderer.invoke('start-ai', modelPath, mmprojPath),
  stopAI: () => ipcRenderer.invoke('stop-ai'),
  pingAI: () => ipcRenderer.invoke('ping-ai'),
  copyAIModel: (sourcePath: string) => ipcRenderer.invoke('copy-ai-model', sourcePath),
  deleteModelFile: (filePath: string) => ipcRenderer.invoke('delete-model-file', filePath),
  getAIError: () => ipcRenderer.invoke('get-ai-error'),
  onCopyProgress: (callback: any) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('copy-progress', subscription);
    return () => ipcRenderer.removeListener('copy-progress', subscription);
  },

  // Window
  winMinimize: () => ipcRenderer.send('win-minimize'),
  winMaximize: () => ipcRenderer.send('win-maximize'),
  winClose: () => ipcRenderer.send('win-close'),
});
