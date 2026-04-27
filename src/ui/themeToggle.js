/**
 * ThemeToggle — sun/moon toggle button.
 * Reads/writes localStorage, sets data-theme on <html>, emits ui:theme-changed.
 */
import { eventBus, Events } from '../core/eventBus.js';

const STORAGE_KEY = 'mc:theme';
const DEFAULT_THEME = 'dark';

/**
 * Reads the saved theme from localStorage, or returns the default.
 * @returns {'dark'|'light'}
 */
function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Applies a theme to <html> and persists it.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable — theme still applied to DOM
  }
}

/**
 * Creates and returns the theme toggle UI component.
 * @returns {{ element: HTMLElement, dispose: function(): void }}
 */
export function createThemeToggle() {
  const button = document.createElement('button');
  button.className = 'btn btn-ghost theme-toggle';
  button.setAttribute('data-testid', 'header-theme-toggle');
  button.setAttribute('aria-label', 'Toggle light/dark theme');
  button.setAttribute('title', 'Toggle theme');
  button.style.fontSize = 'var(--text-xl)';
  button.style.padding = 'var(--space-2)';
  button.style.lineHeight = '1';

  // Initialise from saved preference
  const initialTheme = getSavedTheme();
  applyTheme(initialTheme);
  button.textContent = initialTheme === 'dark' ? '☀️' : '🌙';
  button.setAttribute('aria-pressed', initialTheme === 'dark' ? 'false' : 'true');

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') ?? DEFAULT_THEME;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    button.textContent = next === 'dark' ? '☀️' : '🌙';
    button.setAttribute('aria-pressed', next === 'dark' ? 'false' : 'true');
    eventBus.emit(Events.UI_THEME_CHANGED, next);
  }

  button.addEventListener('click', toggle);

  return {
    element: button,
    dispose() {
      button.removeEventListener('click', toggle);
    },
  };
}
