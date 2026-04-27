/**
 * FaceSequence — manages the 6-face scanning order and stores confirmed results.
 * Order per SPEC §3: F → R → B → L → U → D.
 */

/**
 * Canonical face descriptors in scan order.
 * @type {Array<{ label: string, name: string, icon: string, instruction: string }>}
 */
export const FACE_ORDER = [
  {
    label: 'F',
    name: 'Front',
    icon: '🟦',
    instruction: 'Hold the front face (towards you) centred in the grid',
  },
  {
    label: 'R',
    name: 'Right',
    icon: '🟥',
    instruction: 'Rotate the cube 90° to put the Right face towards you',
  },
  {
    label: 'B',
    name: 'Back',
    icon: '🟧',
    instruction: 'Rotate the cube another 90° to put the Back face towards you',
  },
  {
    label: 'L',
    name: 'Left',
    icon: '🟩',
    instruction: 'Rotate the cube another 90° to put the Left face towards you',
  },
  {
    label: 'U',
    name: 'Top',
    icon: '⬜',
    instruction: 'Tilt the cube upward so the Top face is towards you',
  },
  {
    label: 'D',
    name: 'Bottom',
    icon: '🟨',
    instruction: 'Tilt the cube downward so the Bottom face is towards you',
  },
];

export class FaceSequence {
  constructor() {
    /** @type {number} */
    this._currentIndex = 0;

    /**
     * Stored color arrays for each confirmed face.
     * @type {Array<string[][]|null>}
     */
    this._results = new Array(6).fill(null);

    /**
     * Pending detection result (set by scanner, read by confirm view).
     * @type {import('../cv/detector.js').DetectionResult|null}
     */
    this._pendingResult = null;
  }

  /**
   * Returns the face descriptor for the current scan step.
   * @returns {{ label: string, name: string, icon: string, instruction: string, index: number }}
   */
  getCurrentFace() {
    const face = FACE_ORDER[this._currentIndex];
    return { ...face, index: this._currentIndex };
  }

  /**
   * Returns the face descriptor for the given index (0–5).
   * @param {number} index
   * @returns {{ label: string, name: string, icon: string, instruction: string, index: number }}
   */
  getFace(index) {
    const face = FACE_ORDER[index];
    return { ...face, index };
  }

  /**
   * Store the detection result for the current face and advance the index.
   * @param {string[][]} colors - 3×3 color grid
   */
  confirmFace(colors) {
    this._results[this._currentIndex] = colors.map((row) => [...row]);
    if (this._currentIndex < 5) {
      this._currentIndex += 1;
    }
    this._pendingResult = null;
  }

  /**
   * Re-scan the current face without advancing (discards pending result).
   */
  rescan() {
    this._pendingResult = null;
  }

  /**
   * Replace the confirmed result for the current face (after editing).
   * @param {string[][]} colors
   */
  updateCurrentFaceColors(colors) {
    this._results[this._currentIndex] = colors.map((row) => [...row]);
  }

  /**
   * Returns true when all 6 faces have been confirmed.
   * @returns {boolean}
   */
  isComplete() {
    return this._results.every((r) => r !== null);
  }

  /**
   * Returns all confirmed face color grids (null for unscanned faces).
   * @returns {Array<string[][]|null>}
   */
  getResults() {
    return this._results.map((r) => (r ? r.map((row) => [...row]) : null));
  }

  /**
   * Returns the number of faces confirmed so far.
   * @returns {number}
   */
  getProgress() {
    return this._results.filter(Boolean).length;
  }

  /** @returns {number} */
  getCurrentIndex() {
    return this._currentIndex;
  }

  /**
   * Store a pending detection result.
   * @param {import('../cv/detector.js').DetectionResult} result
   */
  setPendingResult(result) {
    this._pendingResult = result;
  }

  /**
   * Retrieve and clear the pending detection result.
   * @returns {import('../cv/detector.js').DetectionResult|null}
   */
  getPendingResult() {
    return this._pendingResult;
  }

  /**
   * Navigate directly to a previously scanned face for rescanning.
   * Only valid if the face at that index has already been confirmed.
   * @param {number} index
   */
  jumpToFace(index) {
    if (index >= 0 && index < 6) {
      this._currentIndex = index;
      this._results[index] = null;
      this._pendingResult = null;
    }
  }

  /** Reset to initial state. */
  reset() {
    this._currentIndex = 0;
    this._results = new Array(6).fill(null);
    this._pendingResult = null;
  }
}

/** Singleton shared across scanner views. */
export const faceSequence = new FaceSequence();
