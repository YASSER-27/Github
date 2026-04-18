export {};

declare global {
  interface Window {
    api: {
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      getRepos: () => Promise<any>;
      createRepo: (name: string) => Promise<boolean>;
      deleteRepo: (name: string) => Promise<boolean>;
      downloadRepo: (name: string) => Promise<{ success: boolean; message?: string }>;
      getRepoFiles: (name: string) => Promise<any[]>;
      getReadme: (name: string) => Promise<string | null>;
      uploadFile: (name: string) => Promise<boolean>;
      selectModel: () => Promise<string | null>;
      startAI: (modelPath: string) => Promise<{ success: boolean; message?: string }>;
      stopAI: () => Promise<boolean>;
      winMinimize: () => void;
      winMaximize: () => void;
      winClose: () => void;
    };
  }
}
