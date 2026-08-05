// Verifies the implementation remains aligned with the immutable manifest contract.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as entry from '../index.js';
import {
  ERROR_CODES,
  EVENT_NAMES,
  NAVIGATION_FAILURE_REASONS,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  ROUTER_ADAPTER_METHODS,
  SERVICE_NAME,
} from '../lib/constants.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const requirements = fs.readFileSync(new URL('../imp/requirements.md', import.meta.url), 'utf8');
const service = manifest.provides.find(({ name }) => name === SERVICE_NAME);
const serviceMethodNames = service.methods.map(({ name }) => name);
const manifestErrorCodes = new Set(service.methods.flatMap(({ errors }) => errors));

function getNavigationFailureReasons() {
  const lines = requirements.split('\n');
  const headingIndex = lines.findIndex((line) => line.includes('`reason` values'));
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => line.startsWith('**') || line.startsWith('## '));
  const sectionEnd = nextHeadingOffset === -1
    ? lines.length
    : headingIndex + 1 + nextHeadingOffset;

  return lines
    .slice(headingIndex + 1, sectionEnd)
    .filter((line) => line.startsWith('- `'))
    .map((line) => line.match(/^- `([^`]+)`/)?.[1])
    .filter(Boolean);
}

test('should_match_plugin_identity_when_manifest_contract_is_loaded', () => {
  assert.equal(manifest.name, PLUGIN_NAME);
  assert.equal(manifest.version, PLUGIN_VERSION);
  assert.equal(manifest.architecture, '0.11');
  assert.equal(manifest.type, 'infrastructure');
  assert.equal(manifest.adapterType, 'router');
});

test('should_match_entry_exports_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(Object.keys(entry).sort(), ['activate', 'prepare']);
});

test('should_match_dependencies_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(manifest.dependencies, { required: [], optional: [] });
});

test('should_match_service_methods_when_manifest_contract_is_loaded', () => {
  assert.equal(service.name, SERVICE_NAME);
  assert.deepEqual(serviceMethodNames, [
    'registerRoutes',
    'navigate',
    'replace',
    'back',
    'forward',
    'getCurrentRoute',
    'matchRoute',
  ]);
});

test('should_match_service_error_codes_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(manifestErrorCodes, new Set([
    ERROR_CODES.MALFORMED_PATH,
    ERROR_CODES.MALFORMED_PATTERN,
    ERROR_CODES.NAVIGATION_FAILED,
  ]));
  assert.equal(ERROR_CODES.EXTERNAL_CHANGE_FAILED, 'ROUTER_EXTERNAL_CHANGE_FAILED');
});

test('should_match_events_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(manifest.events.map(({ name }) => name), Object.values(EVENT_NAMES));
  assert.deepEqual(
    manifest.events.find(({ name }) => name === EVENT_NAMES.NAVIGATION_FAILED).data.map(({ name }) => name),
    ['path', 'reason'],
  );
});

test('should_match_default_config_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(manifest.config, {
    basePath: '/',
    notFoundPath: '/not-found',
  });
});

test('should_match_adapter_contract_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(ROUTER_ADAPTER_METHODS, [
    'getCurrentPath',
    'pushEntry',
    'replaceEntry',
    'goBack',
    'goForward',
    'onExternalChange',
  ]);
});

test('should_match_navigation_failure_reason_when_manifest_contract_is_loaded', () => {
  assert.deepEqual(
    Object.values(NAVIGATION_FAILURE_REASONS),
    getNavigationFailureReasons(),
  );
});
