/**
 * PluginRegistry — manages puzzle type plugins.
 * Each plugin must implement the PuzzlePlugin interface (SPEC §1.1)
 * and declare a compatible apiVersion.
 */

/** Current plugin API version supported by this core. */
export const PLUGIN_API_VERSION = 1;

/**
 * Required top-level fields for a valid plugin.
 * @type {string[]}
 */
const REQUIRED_FIELDS = ['id', 'name', 'description', 'icon', 'apiVersion', 'geometry'];

/**
 * Required factory methods on a plugin.
 * @type {string[]}
 */
const REQUIRED_METHODS = ['getScanner', 'getSolver', 'getRenderer', 'getValidator'];

class PluginRegistry {
  constructor() {
    /** @type {Map<string, object>} */
    this._plugins = new Map();
  }

  /**
   * Registers a puzzle plugin after validating its interface and API version.
   * @param {object} plugin - Plugin object implementing PuzzlePlugin interface
   * @throws {Error} If the plugin is invalid or already registered
   */
  register(plugin) {
    // Validate required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in plugin)) {
        throw new Error(`[PluginRegistry] Plugin missing required field: "${field}"`);
      }
    }

    // Validate required methods
    for (const method of REQUIRED_METHODS) {
      if (typeof plugin[method] !== 'function') {
        throw new Error(
          `[PluginRegistry] Plugin "${plugin.id}" missing required method: "${method}"`
        );
      }
    }

    // Check API version compatibility
    if (typeof plugin.apiVersion !== 'number') {
      throw new Error(`[PluginRegistry] Plugin "${plugin.id}" apiVersion must be a number`);
    }
    if (plugin.apiVersion > PLUGIN_API_VERSION) {
      throw new Error(
        `[PluginRegistry] Plugin "${plugin.id}" requires API version ${plugin.apiVersion} ` +
          `but core only supports up to ${PLUGIN_API_VERSION}`
      );
    }

    // Prevent duplicate registration
    if (this._plugins.has(plugin.id)) {
      throw new Error(`[PluginRegistry] Plugin "${plugin.id}" is already registered`);
    }

    this._plugins.set(plugin.id, plugin);
  }

  /**
   * Retrieves a registered plugin by its ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  get(id) {
    return this._plugins.get(id);
  }

  /**
   * Returns an array of all registered plugins.
   * @returns {object[]}
   */
  list() {
    return [...this._plugins.values()];
  }

  /**
   * Unregisters a plugin by ID. Used for hot-reload in development.
   * @param {string} id
   * @returns {boolean} Whether the plugin was found and removed
   */
  unregister(id) {
    return this._plugins.delete(id);
  }

  /**
   * Returns true if a plugin with the given ID is registered.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._plugins.has(id);
  }

  /**
   * Returns the number of registered plugins.
   * @returns {number}
   */
  get size() {
    return this._plugins.size;
  }
}

/** Singleton instance. */
export const pluginRegistry = new PluginRegistry();

/** Named export for testing. */
export { PluginRegistry };
