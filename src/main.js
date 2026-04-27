/**
 * main.js — application entry point.
 * Imports all styles, then mounts the app shell.
 * Core singletons (eventBus, stateMachine, pluginRegistry) are lazily
 * initialised when their modules are first imported by app.js.
 */

// ── Styles ─────────────────────────────────────────────────────────────────
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/landing.css';

// ── App shell ──────────────────────────────────────────────────────────────
import { createApp } from './ui/app.js';

const root = document.getElementById('app');
if (!root) {
  throw new Error('[main] #app element not found in DOM');
}

createApp(root);
