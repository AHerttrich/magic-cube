/**
 * Scene — Three.js scene wrapper.
 * Handles camera, lights, OrbitControls, animation loop, responsive sizing,
 * and complete resource disposal per ARCH §6.3.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * @typedef {Object} SceneOptions
 * @property {boolean} [autoRotate=false] - Enable OrbitControls auto-rotation
 * @property {number} [autoRotateSpeed=2.0] - Auto-rotation speed
 * @property {boolean} [enableOrbit=true] - Enable user orbit interaction
 * @property {number[]} [cameraPosition=[4, 3, 5]] - Initial camera position [x, y, z]
 * @property {string} [background=null] - CSS color string for background, or null for transparent
 */

export class Scene {
  /**
   * @param {SceneOptions} [options]
   */
  constructor(options = {}) {
    const {
      autoRotate = false,
      autoRotateSpeed = 2.0,
      enableOrbit = true,
      cameraPosition = [4, 3, 5],
      background = null,
    } = options;

    this._scene = new THREE.Scene();
    if (background) {
      this._scene.background = new THREE.Color(background);
    }

    // Camera
    this._camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this._camera.position.set(...cameraPosition);
    this._camera.lookAt(0, 0, 0);

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: background === null,
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.shadowMap.enabled = false;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this._scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 8, 5);
    this._scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, -2, -3);
    this._scene.add(fillLight);

    // OrbitControls
    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.06;
    this._controls.autoRotate = autoRotate;
    this._controls.autoRotateSpeed = autoRotateSpeed;
    this._controls.enablePan = false;
    this._controls.enableZoom = enableOrbit;
    this._controls.minDistance = 3;
    this._controls.maxDistance = 14;
    this._controls.target.set(0, 0, 0);

    // State
    this._animationId = null;
    this._container = null;
    this._resizeObserver = null;
  }

  /**
   * Adds a Three.js object to the scene.
   * @param {THREE.Object3D} object
   */
  add(object) {
    this._scene.add(object);
  }

  /**
   * Removes a Three.js object from the scene.
   * @param {THREE.Object3D} object
   */
  remove(object) {
    this._scene.remove(object);
  }

  /**
   * Mounts the renderer canvas into the given DOM container and starts
   * observing it for resize events.
   * @param {HTMLElement} container
   */
  mount(container) {
    this._container = container;
    container.appendChild(this._renderer.domElement);
    this._updateSize();

    this._resizeObserver = new ResizeObserver(() => this._updateSize());
    this._resizeObserver.observe(container);
  }

  /**
   * Starts the animation loop.
   */
  start() {
    if (this._animationId !== null) { return; }

    const tick = () => {
      this._animationId = requestAnimationFrame(tick);
      this._controls.update();
      this._renderer.render(this._scene, this._camera);
    };
    tick();
  }

  /**
   * Stops the animation loop.
   */
  stop() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * Fully disposes all Three.js resources and DOM elements.
   * Must be called when the component using this scene is destroyed.
   */
  dispose() {
    this.stop();

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    this._controls.dispose();

    // Traverse scene graph and dispose geometries + materials
    this._scene.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => m.dispose());
      }
    });

    // Remove canvas from DOM
    const canvas = this._renderer.domElement;
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    this._renderer.dispose();
    this._renderer.forceContextLoss();

    // Nullify references to allow GC
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._controls = null;
    this._container = null;
  }

  /**
   * Updates renderer size and camera aspect to match the container's current dimensions.
   * @private
   */
  _updateSize() {
    if (!this._container || !this._renderer) { return; }
    const { width, height } = this._container.getBoundingClientRect();
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h, false);
  }
}
