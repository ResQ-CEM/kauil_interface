# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run tauri dev       # Start app with hot reload (frontend + native window)
npm run dev             # Start Vite dev server only (no native window)
```

### Build
```bash
npm run tauri build     # Build production app bundle
npm run build           # TypeScript check + Vite build only
```

### Rust backend
```bash
cd src-tauri && cargo check    # Check Rust code without building
cd src-tauri && cargo clippy   # Lint Rust code
```

## Architecture

This is a **Tauri 2** desktop app — a React/TypeScript frontend communicating with a Rust backend via Tauri's IPC bridge.

### Frontend → Backend communication

React code calls Rust functions using Tauri's `invoke`:
```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("command_name", { arg: value });
```

Rust functions are exposed as commands with `#[tauri::command]` and registered in `src-tauri/src/lib.rs` via `generate_handler![]`.

### Key files

- `src/App.tsx` — main React component (UI lives here)
- `src-tauri/src/lib.rs` — Rust command definitions and app setup
- `src-tauri/tauri.conf.json` — app metadata, window size (800×600), bundle config
- `src-tauri/capabilities/default.json` — security permissions for Tauri plugins

### Adding a new backend command

1. Define the function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Register it in `generate_handler![existing_cmd, new_cmd]`
3. Call it from the frontend with `invoke("new_cmd", { ... })`

Serde handles serialization automatically — function args and return types must implement `Serialize`/`Deserialize`.
