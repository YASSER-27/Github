#!/usr/bin/env node

import { Command } from 'commander';
import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import os from 'os';

const program = new Command();
const git = simpleGit();

const GITBOT_DIR = path.join(os.homedir(), '.gitbot');
const REPOS_DIR = path.join(GITBOT_DIR, 'repos');

program
  .name('gbot')
  .description('Gitbot local CLI to interact with your personal Gitbot Hub')
  .version('1.0.0');

// Initializing a remote Gitbot Repo and linking current directory to it
program
  .command('init-repo')
  .description('Initialize a Gitbot repository for the current project')
  .argument('[repo-name]', 'Name of the repository', path.basename(process.cwd()))
  .action(async (repoName) => {
    try {
      const bareRepoPath = path.join(REPOS_DIR, `${repoName}.git`);
      
      if (!fs.existsSync(REPOS_DIR)) {
        fs.mkdirSync(REPOS_DIR, { recursive: true });
      }

      if (fs.existsSync(bareRepoPath)) {
        console.error(`Error: Repository ${repoName} already exists in Gitbot.`);
        process.exit(1);
      }

      console.log(`Setting up Gitbot repo: ${repoName}...`);
      
      // Initialize a bare repo
      const bareGit = simpleGit(bareRepoPath);
      fs.mkdirSync(bareRepoPath, { recursive: true });
      await bareGit.init(true);

      // Initialize local repo if not already a git repo
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        await git.init();
        console.log('Initialized local empty git repository.');
      }

      // Add remote
      const remotes = await git.getRemotes();
      if (remotes.find(r => r.name === 'gitbot')) {
        await git.removeRemote('gitbot');
      }
      
      // Using forward slashes for Windows paths in git
      const remotePath = bareRepoPath.replace(/\\/g, '/');
      await git.addRemote('gitbot', `file://${remotePath}`);
      
      console.log(`Success! Linked to Gitbot remote: gitbot`);
      console.log(`Run 'gbot save "message"' to commit and 'gbot sync' to push.`);
    } catch (err) {
      console.error('Failed to initialize repo:', err);
    }
  });

program
  .command('save')
  .description('Stage all changes and commit')
  .argument('<message>', 'Commit message')
  .action(async (message) => {
    try {
      await git.add('.');
      await git.commit(message);
      console.log(`Saved (committed): ${message}`);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  });

program
  .command('sync')
  .description('Push changes to your local Gitbot Hub')
  .action(async () => {
    try {
      const status = await git.status();
      const currentBranch = status.current || 'main';
      console.log(`Syncing branch ${currentBranch} to Gitbot...`);
      await git.push('gitbot', currentBranch);
      console.log('Successfully synced!');
    } catch (err) {
      console.error('Failed to sync. Make sure you set up an upstream or ran "gbot init-repo" first.', err);
    }
  });

program.parse();
