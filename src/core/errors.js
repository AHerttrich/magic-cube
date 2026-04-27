/**
 * Errors — standardized error objects with typed codes.
 * Error codes from SPEC §7.
 */

/**
 * All error codes used across the application.
 * @enum {string}
 */
export const ErrorCode = {
  // Computer Vision
  CV_INIT_FAILED: 'CV_INIT_FAILED',
  CV_NO_FACE: 'CV_NO_FACE',
  CV_PARTIAL_GRID: 'CV_PARTIAL_GRID',
  CV_LOW_LIGHT: 'CV_LOW_LIGHT',
  CV_COLOR_AMBIGUOUS: 'CV_COLOR_AMBIGUOUS',

  // Calibration
  CAL_NO_CENTER: 'CAL_NO_CENTER',
  CAL_INSUFFICIENT: 'CAL_INSUFFICIENT',

  // Validation
  VAL_COLOR_COUNT: 'VAL_COLOR_COUNT',
  VAL_INVALID_PIECE: 'VAL_INVALID_PIECE',
  VAL_PARITY: 'VAL_PARITY',

  // Solver
  SOL_INIT_FAILED: 'SOL_INIT_FAILED',
  SOL_UNSOLVABLE: 'SOL_UNSOLVABLE',
  SOL_TIMEOUT: 'SOL_TIMEOUT',

  // Renderer
  REN_WEBGL_UNSUPPORTED: 'REN_WEBGL_UNSUPPORTED',
};

/**
 * Human-readable messages for each error code.
 * @type {Record<string, string>}
 */
const ERROR_MESSAGES = {
  [ErrorCode.CV_INIT_FAILED]: 'OpenCV.js failed to initialize',
  [ErrorCode.CV_NO_FACE]: 'No face grid detected in frame',
  [ErrorCode.CV_PARTIAL_GRID]: 'Detected fewer tiles than expected',
  [ErrorCode.CV_LOW_LIGHT]: 'Insufficient lighting for reliable detection',
  [ErrorCode.CV_COLOR_AMBIGUOUS]: 'Multiple tiles have uncertain color assignment',
  [ErrorCode.CAL_NO_CENTER]: 'Could not detect center square for calibration',
  [ErrorCode.CAL_INSUFFICIENT]: 'Not enough reference colors for calibration',
  [ErrorCode.VAL_COLOR_COUNT]: 'Wrong number of a specific color — check your scan',
  [ErrorCode.VAL_INVALID_PIECE]: 'Invalid edge or corner piece detected — rescan affected face',
  [ErrorCode.VAL_PARITY]: 'Parity error — this state is physically impossible',
  [ErrorCode.SOL_INIT_FAILED]: 'Solver failed to initialize',
  [ErrorCode.SOL_UNSOLVABLE]: 'Could not find a solution for this state',
  [ErrorCode.SOL_TIMEOUT]: 'Solver exceeded the time limit',
  [ErrorCode.REN_WEBGL_UNSUPPORTED]: 'WebGL is not available in this browser',
};

/**
 * Structured application error with a typed code and optional context.
 */
export class AppError extends Error {
  /**
   * @param {string} code - One of ErrorCode values
   * @param {string} [message] - Optional override message (defaults to code's standard message)
   * @param {object} [context] - Optional structured data for debugging
   */
  constructor(code, message, context = {}) {
    const defaultMessage = ERROR_MESSAGES[code] ?? `Unknown error: ${code}`;
    super(message ?? defaultMessage);

    this.name = 'AppError';
    this.code = code;
    this.context = context;

    // Preserve stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Returns a plain serializable object for postMessage / logging.
   * @returns {{ code: string, message: string, context: object }}
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }

  /**
   * Reconstructs an AppError from a serialized JSON object.
   * @param {{ code: string, message?: string, context?: object }} data
   * @returns {AppError}
   */
  static fromJSON(data) {
    return new AppError(data.code, data.message, data.context ?? {});
  }
}
