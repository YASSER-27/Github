<p align="center">
  <img src="assets/GitBot.png" width="150" alt="Edit Img Tool Logo">
  <h1 align="center">Gitbot</h1>
  <p align="center">Advanced Local AI Project Manager</p>
</p>
<p align="center">
  <a href="https://github.com/YASSER-27/Github/releases">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge&logo=github" alt="Download Latest Release">
</p>

>Welcome to **Gitbot**, a professional, fully offline, and highly secure Desktop application built with **Electron + React + Vite**. Gitbot is designed as your intelligent AI copilot and version control hub, managing your code repositories and giving you instant AI insights entirely on your local machine.

[Download Gitbot windows ](https://github.com/YASSER-27/Github/releases/download/v1/Gitbot.exe)

## Key Features

### 1. 100% Offline AI Inference (Llama)
- **Local & Private:** Gitbot connects directly to an onboard `llama-server.exe` instance running locally via C++. Zero telemetry, zero cloud calls, completely air-gapped processing.
- **AI Copilot & Code Generation:** A dedicated AI Chat interface lets you ideate, debug, and write code.
- **Instant Project Scaffolding:** Use the powerful `/plan` command in the AI Copilot. The AI will instantly generate an entire project structure and create all the necessary files simultaneously inside your repositories.

### 2. Intelligent Repository Management
- **Centralized Hub:** All your projects are stored cleanly outside the application scope in `~/.gitbot/repos`, ensuring your work is persistent and immune to application updates or uninstalls.
- **Smart Folder Imports:** Upload any local project, and Gitbot intelligently crawls and imports the files cleanly without weird folder-nesting behaviors.
- **Snapshot (Commit) System:** Save the state of your project by making a "Commit". Gitbot packages the entire state into a secure `.zip` file stored safely in the project's background `commits` folder. Revert or inspect previous states instantly.
- **Releases:** Export and compile finished projects as versions (e.g., v1.0.0) ready for deployment.

### 3. State-of-the-art UI / UX
- **Dynamic Theming:** Choose between Default Dark, Light Mode, and "GitHub Deep", managed efficiently via real-time CSS variable bindings.
- **Custom Markdown Renderer:** The integrated file viewer uses `react-markdown` with explicit custom secure protocols (`gitbot-repo://` and `gitbot-profile://`) registered in Electron to seamlessly bypass CSP restrictions and render local project images inside your Markdown.
- **Animated Startup Details:** Features an introductory animated screen (with global toggle) and a persistent state layout mimicking high-end developer IDEs.

### Plan mode work 

| 1 | 2 | 3 | 4 | 5 |
|:---:|:---:|:---:|:---:|:---:|
| ![ai_panel](assets/ai_panel.png) | ![ai_plan_creat_auto](assets/ai_plan_creat_auto.png) | ![ai_plan_in_Repositor](assets/ai_plan_in_Repositor.png) | ![ai_plan_mode](assets/ai_plan_mode.png) | ![ai_plan_select](assets/ai_plan_select.png) |

### Settinges

<div align='center'>

<img src='assets/system_prompt.png' width='32%' style='margin:5px;' />
<img src='assets/Repositories_download.png' width='32%' style='margin:5px;' />
<img src='assets/profile_settinges.png' width='32%' style='margin:5px;' />
<img src='assets/themes.png' width='32%' style='margin:5px;' />

</div>

### AI Panel

| Simple ai | Diagram mod |
|---|---|
| ![ai_panel](assets/ai_panel.png) | ![diagram_ai](assets/diagram_ai.png) |


### GitBot


<div align='center'>


<img src='assets/Repository.png' width='50%' style='margin:5px;' />
<img src='assets/ai_plan_creat_auto.png' width='50%' style='margin:5px;' />

</div>

### More :


| Image | Image |
|---|---|
| ![themes](assets/themes.png) | ![csv_mode](assets/csv_mode.png) |
| ![hrml_mode](assets/hrml_mode.png) | ![readme_mode](assets/readme_mode.png) |

---

## Technical Architecture

- **Frontend:** React + Vite, fully statically typed with TypeScript. Uses `lucide-react` for beautiful vector icons.
- **Backend (Node.js/Electron):** The `electron/main.ts` orchestrates the local OS bridging. It manages:
  - File archiving and zipping utilizing `archiver` package.
  - Spawning the background AI processes with configured multithreading (`--ctx-size 8192`, `--parallel 1`, etc.).
  - Bypassing standard secure web contexts via `protocol.registerSchemesAsPrivileged` to map system folder paths perfectly.
- **AI Connectivity:** Communicates with the AI via a fetch API wrapper (`AIContext.tsx`) that intercepts streaming chunks and processes them flawlessly even if the AI randomly cuts out. A heavily optimized Fallback JSON parser reliably rebuilds interrupted AI generation streams.

##  How to run locally

### 1. Setup Environment
Ensure you have Node.js installed. Gitbot assumes the presence of a local `.gguf` AI model at the path: `Documents/github/gitbot/cpp/gemma-4-E2B-it-Q4_K_M.gguf`. (A compliant `llama-server.exe` must exist in `cpp/`).

### 2. Start Developing
```bash
npm install
npm run dev
```
Wait 2 to 3 seconds for the Main process to spawn the AI server in the background.

### 3. Build & Package
```bash
npm run build
```
This prepares the React UI, statically compiles the Vite output into `dist/`, and prepares the Electron binaries to be packed into a portable executable (e.g. using `electron-builder`).

## Developer
Engineered & Designed by **YASSER-27**.
Built with precision for uncompromised local AI productivity.
