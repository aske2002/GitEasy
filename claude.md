# GitEasy Project Knowledge (claude.md)

## 1) Project Overview
GitEasy is a desktop Git client built with Electron, React, and TypeScript.

Primary goals:
- Visualize repository history as a graph.
- Perform common Git actions without leaving the app.
- Manage branches/remotes/tags/stashes and inspect diffs.
- Support authenticated operations for hosted Git providers.

Current package metadata (from package.json):
- Name: giteasy
- Version: 2.0.0
- Description: A beautiful, intuitive Git client
- App ID: com.giteasy.app
- Product Name: GitEasy

## 2) Tech Stack
- Runtime shell: Electron
- Build tooling: electron-vite + Vite
- Renderer: React 19 + TypeScript
- Styling: Tailwind CSS (v4 import style) + CSS variables
- State management: Zustand
- Drag and drop: @dnd-kit/core
- Syntax highlighting in diff views: shiki
- Local persistence: electron-store
- File watching: chokidar
- Updates: electron-updater

## 3) Repository Layout
Top-level:
- build/ (packaging assets, entitlements)
- scripts/ (release automation)
- src/main/ (Electron main process)
- src/preload/ (context bridge)
- src/shared/ (shared IPC channels/types)
- src/renderer/ (React app)

Main process Git modules (src/main/git):
- runner.ts: safe Git command execution wrapper (spawn, shell=false)
- log.ts: graph commit retrieval/parsing
- refs.ts: branch/tag/stash refs metadata
- status.ts: staged/unstaged/untracked status and commit helpers
- diff.ts: commit/file/working/staged diff retrieval and file restore
- checkout.ts: checkout/reset/merge/rebase/fetch/pull/push/branch/tag/clone
- remotes.ts: list/add/remove/rename/set-url remotes
- stash.ts: create/pop/apply/drop stash
- conflict.ts: parse conflict markers and resolve conflicts
- auth.ts: account verification/storage and remote repo listing
- watcher.ts: watches .git and emits repo refresh notifications

Renderer major component groups:
- components/Layout: app shell, toolbar, welcome screen
- components/GitGraph: graph visualization and context menus
- components/Sidebar: branches/remotes/stashes/tags/changes panels
- components/CommitPanel: commit inspector, file tree/list, conflict editor
- components/DiffViewer: inline/unified diff rendering
- components/Modals: operation dialogs and management modals

## 4) Architecture and Data Flow
### 4.1 Process boundaries
- Renderer never executes Git directly.
- Renderer calls window.git API exposed by preload.
- Preload uses ipcRenderer.invoke/send with typed IPC channels.
- Main process handlers dispatch to src/main/git modules.

### 4.2 Security model
- BrowserWindow uses contextIsolation=true and nodeIntegration=false.
- Git commands use child_process spawn with args arrays (no shell interpolation).
- Account tokens are encrypted using Electron safeStorage when available.
- External links are opened via shell.openExternal.

### 4.3 Reactive updates
- .git watcher emits IPC.REPO_CHANGED for changes in refs/index/head/etc.
- Renderer listens and refreshes graph/refs/status.
- Global shortcuts:
  - Cmd/Ctrl+O: open repo picker
  - Cmd/Ctrl+R: trigger refresh

## 5) Core Features
### 5.1 Repository lifecycle
- Open repository from folder picker or recent list.
- Validate .git directory before opening.
- Persist recent repositories in electron-store.

### 5.2 Graph and history
- Commit graph rendering with lanes and parent connections.
- Commit context menu supports checkout/reset/copy operations.
- Branch label interactions include drag/drop workflows.

### 5.3 Branch operations
- Checkout local/remote branches.
- Create/delete/rename branches.
- Delete remote branches.
- Drag/drop branch operations with merge/rebase dialog.

### 5.4 Pull/push/fetch
- Fetch all remotes.
- Pull supports:
  - standard pull
  - pull with rebase
- Push and force push supported.

### 5.5 Diff and inspection
- Commit-level and file-level diffs.
- Working tree and staged diffs.
- Commit inspector with tree/list file navigation.
- File content retrieval and restore-to-commit support.

### 5.6 Staging/commit
- Stage/unstage single files.
- Stage all / unstage all.
- Commit with message.

### 5.7 Stash support
- Create stash.
- Apply stash.
- Pop stash.
- Drop/delete stash.
- Stashes are visible in sidebar and graph references.

### 5.8 Remotes management
- List remotes and fetch/push URLs.
- Add/remove/rename remotes.
- Update remote URLs.

### 5.9 Merge conflict tooling
- Parse conflict markers into structured segments.
- Resolve conflicts by writing resolved content and staging file.

### 5.10 Accounts and authenticated operations
Providers currently supported:
- GitHub
- GitLab (cloud and self-hosted)
- Bitbucket
- custom (self-hosted GitLab flow)

Capabilities:
- Verify and connect accounts.
- List remote repositories for clone modal.
- Build authenticated HTTPS URLs for clone/fetch/pull/push flows.

## 6) IPC Surface (High-Level)
Shared in src/shared/ipc.ts:
- Repo channels: open, recent list
- Graph/refs/status channels
- Diff/content channels
- Operations: checkout/reset/merge/rebase/fetch/pull/push/branch/tag/cherry-pick
- Staging/commit channels
- Stash channels
- Remotes channels
- Conflict channels
- Auth/account channels
- Clone/directory channels
- Updater channels/events

Main IPC registration is in src/main/ipc/handlers.ts.
Preload API shape is in src/preload/index.ts.

## 7) Renderer State Model (Zustand)
Store in src/renderer/src/store/repoStore.ts keeps:
- Repo identity/loading/error state
- Graph commits/nodes/refs
- Working status files
- Selected commit/file and inspector state
- Operation progress/error state

Actions include:
- refresh/open/close
- graph selection and inspector updates
- all branch/tag/remote/stash operations
- fetch/pull/push/force push
- stage/unstage/commit

## 8) UI Structure
- App root: App.tsx
  - If no repo: WelcomeScreen
  - If repo open: AppShell + OperationDialog
- AppShell layout:
  - Toolbar (top)
  - Sidebar (left, resizable)
  - GitGraph (center)
  - CommitInspector (right, resizable when open)

Toolbar includes:
- Clone
- Fetch
- Pull + pull options (including Pull Rebase)
- Stash (enabled only when changes exist)
- Push / Force Push (when needed)
- Refresh
- Accounts
- Update status/actions

## 9) Styling and Theme
Global styling in src/renderer/src/styles/globals.css.
- Tailwind base import via @import "tailwindcss";
- Dark theme CSS variables define backgrounds, borders, text, accents, semantic colors.
- Custom scrollbar styles.
- Drag-region/no-drag classes for macOS titlebar behavior.

## 10) Build, Run, Release
NPM scripts:
- dev/start: electron-vite dev
- build: electron-vite build
- preview: electron-vite preview
- dist:mac: build + electron-builder --mac
- dist:win: build + electron-builder --win
- release: bash scripts/release.sh

Release script behavior (scripts/release.sh):
1. Bump package.json version (no auto tag from npm)
2. Commit version bump
3. Create git tag v<version>
4. Push commit and tag
5. CI/GitHub release pipeline handles build/publish

## 11) Packaging and Distribution
electron-builder config in package.json:
- publish provider: GitHub (aske2002/GitEasy)
- macOS targets: dmg and zip (arm64, x64)
- Windows target: nsis
- macOS hardened runtime and notarization enabled
- entitlements file: build/entitlements.mac.plist

## 12) Notable Implementation Details
- Main process window defaults:
  - 1400x900, min 900x600
  - hiddenInset title bar on macOS
- Auto-updater:
  - checks for updates in packaged builds
  - sends update available/downloaded/error events to renderer
- Conflict resolution:
  - parser understands <<<<<<<, =======, >>>>>>> blocks
  - resolved output is written then staged via git add

## 13) Current Operational Conventions
- All Git operations are intended to flow through typed IPC and repoStore actions.
- Refresh is commonly triggered after successful operations.
- Operation failures surface via OperationDialog using operationError state.

## 14) Quick Start for Contributors
1. Install dependencies (npm install)
2. Run dev mode (npm run dev)
3. Open a local Git repository in the app
4. Use npm run build before release
5. Use npm run release <version> for tagged release flow

## 15) Purpose of This File
This file is a consolidated project knowledge reference for assistants and contributors so they can understand architecture, features, and operational workflows quickly without scanning the full codebase first.
