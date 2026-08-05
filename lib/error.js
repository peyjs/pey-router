// Creates safe Bonyan errors at the router plugin boundary.

import { ERROR_CODES, PLUGIN_NAME } from './constants.js';

const ERROR_TYPES = new Set(['startup', 'operational', 'critical']);
const DEFAULT_ADAPTER_ERROR_MESSAGE = 'Router adapter operation failed';

function assertErrorType(type) {
  if (!ERROR_TYPES.has(type)) {
    throw new TypeError(`Unsupported Bonyan error type: ${type}`);
  }
}

/**
 * Creates a standard Bonyan error owned by this plugin.
 *
 * @param {string} code Stable machine-readable error code.
 * @param {string} message Safe human-readable message.
 * @param {'startup'|'operational'|'critical'} [type='operational'] Error category.
 * @returns {{code: string, message: string, source: string, type: string, timestamp: string}}
 * @throws {TypeError} When the error type is unsupported.
 */
export function createRouterError(code, message, type = 'operational') {
  assertErrorType(type);

  return {
    code,
    message,
    source: PLUGIN_NAME,
    type,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Converts any adapter failure into a safe router-owned Bonyan error.
 *
 * @param {unknown} error Raw or structured adapter failure.
 * @param {string} [code=ERROR_CODES.NAVIGATION_FAILED] Router-facing error code.
 * @param {string} [message=DEFAULT_ADAPTER_ERROR_MESSAGE] Safe replacement message.
 * @param {'startup'|'operational'|'critical'} [type='operational'] Error category.
 * @returns {{code: string, message: string, source: string, type: string, timestamp: string}}
 * @throws {TypeError} When the error type is unsupported.
 */
export function normalizeAdapterError(
  error,
  code = ERROR_CODES.NAVIGATION_FAILED,
  message = DEFAULT_ADAPTER_ERROR_MESSAGE,
  type = 'operational',
) {
  void error;
  return createRouterError(code, message, type);
}
