/**
 * Landing — premium landing page view with animated Three.js cube.
 *
 * Returns { container, mount, unmount } following the view lifecycle contract:
 *   1. createLandingView() builds DOM without starting Three.js
 *   2. Caller appends container to the DOM
 *   3. Caller invokes mount() to initialise Three.js (needs container in DOM for sizing)
 *   4. Caller invokes unmount() when navigating away (disposes Three.js resources)
 */
import { Scene } from '../viz/scene.js';
import { createCubeMesh } from '../viz/cubeMesh.js';
import { stateMachine, Action } from '../core/stateMachine.js';
import { faceSequence } from '../scanner/faceSequence.js';

/**
 * Creates the landing page view.
 * @returns {{ container: HTMLElement, mount: function(): void, unmount: function(): void }}
 */
export function createLandingView() {
  const container = document.createElement('div');
  container.className = 'landing';

  container.innerHTML = `
    <!-- ── Hero ── -->
    <section class="landing-hero" aria-label="Hero section">

      <!-- Three.js canvas placeholder -->
      <div
        class="landing-canvas-container"
        data-testid="landing-cube-canvas"
        aria-hidden="true"
      ></div>

      <!-- Hero copy + CTA -->
      <div class="landing-hero-content">
        <h1 class="landing-tagline">
          Solve any twisty puzzle from a photo&nbsp;—&nbsp;instantly, free.
        </h1>

        <div class="landing-cta">
          <button
            class="btn btn-primary"
            data-testid="landing-cta-scan"
            type="button"
          >
            📸 Scan My Cube
          </button>
        </div>
      </div>
    </section>

    <!-- ── How it works ── -->
    <section class="landing-how-it-works" aria-label="How it works">
      <h2>How it works</h2>
      <div class="landing-steps" role="list">

        <article
          class="landing-step glass-card"
          role="listitem"
          data-testid="landing-step-scan"
        >
          <span class="landing-step-icon" aria-hidden="true">📷</span>
          <h3>1. Scan</h3>
          <p>Point your camera at each of the six faces. The app detects colours in real time.</p>
        </article>

        <article
          class="landing-step glass-card"
          role="listitem"
          data-testid="landing-step-verify"
        >
          <span class="landing-step-icon" aria-hidden="true">✅</span>
          <h3>2. Verify</h3>
          <p>Review the detected colours and fix any tiles that were mis-identified.</p>
        </article>

        <article
          class="landing-step glass-card"
          role="listitem"
          data-testid="landing-step-solve"
        >
          <span class="landing-step-icon" aria-hidden="true">🎯</span>
          <h3>3. Solve</h3>
          <p>Get your optimal solution — ≤ 20 moves — in under 2 seconds.</p>
        </article>

      </div>
    </section>

    <!-- ── Privacy ── -->
    <div class="landing-privacy" aria-label="Privacy guarantee">
      <p class="landing-privacy-badge" data-testid="landing-privacy-badge">
        🔒 Your photos never leave your device
      </p>
    </div>
  `;

  /** @type {Scene|null} */
  let scene = null;

  /** @type {(() => void)[]} */
  const cleanups = [];

  function mount() {
    const canvasContainer = container.querySelector('.landing-canvas-container');
    if (!canvasContainer) { return; }

    scene = new Scene({
      autoRotate: true,
      autoRotateSpeed: 1.8,
      enableOrbit: false,
      cameraPosition: [4.5, 3.0, 5.5],
    });

    const cubeMesh = createCubeMesh();
    scene.add(cubeMesh);
    scene.mount(canvasContainer);
    scene.start();

    // Wire the "Scan My Cube" CTA button
    const ctaBtn = container.querySelector('[data-testid="landing-cta-scan"]');
    if (ctaBtn) {
      const onScan = () => {
        // Reset face sequence for a fresh scan, then jump to PuzzleSelect → Scanning
        faceSequence.reset();
        try {
          stateMachine.transition(Action.SELECT_PUZZLE);
          stateMachine.transition(Action.START_SCAN);
        } catch {
          // Already in a valid state — ignore
        }
      };
      ctaBtn.addEventListener('click', onScan);
      cleanups.push(() => ctaBtn.removeEventListener('click', onScan));
    }
  }

  function unmount() {
    if (scene) {
      scene.dispose();
      scene = null;
    }
    for (const fn of cleanups) { fn(); }
    cleanups.length = 0;
  }

  return { container, mount, unmount };
}
