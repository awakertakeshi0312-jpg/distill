# Distill

Distill is a local-first personal thinking environment for capturing fragments, reconnecting them by meaning and context, and maturing them into durable knowledge.

## Current State

This repository contains:

- Product strategy and architecture docs in `docs/`.
- A Vite React/TypeScript prototype for the core app shell.
- A working first screen for Inbox, Today context, hybrid search, backlinks context, and projects.

## Development

Install dependencies:

```powershell
npm install
```

Run the app:

```powershell
npm run dev
```

Build:

```powershell
npm run build
```

## Desktop Shell

The intended desktop stack is Tauri. This environment currently does not have Rust/Cargo installed, so the Tauri shell is not scaffolded yet. Once Rust is available, add Tauri around the existing React app layer.

