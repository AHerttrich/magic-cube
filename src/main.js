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
import './styles/scanner.css';
import './styles/faceConfirm.css';
import './styles/faceEditor.css';
import './styles/calibration.css';
import './styles/cubePreview.css';
import './styles/validating.css';
import './styles/solving.css';
import './styles/solution.css';
import './styles/solver.css';

// ── App shell ──────────────────────────────────────────────────────────────
import { createApp } from './ui/app.js';
import { calibrationEngine } from './cv/calibration.js';
import { solverEngine } from './solver/solver.js';

const root = document.getElementById('app');
if (!root) {
  throw new Error('[main] #app element not found in DOM');
}

// Load persisted calibration profile on startup
calibrationEngine.loadSavedProfile();

// Warm up the solver in the background so pruning tables are ready
// by the time the user finishes scanning all 6 faces
solverEngine.init().catch(() => {
  // Init failure will be surfaced when the user reaches the Solving view
});

createApp(root);
