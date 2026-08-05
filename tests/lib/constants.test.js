import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  ERROR_CODES,
  EVENT_NAMES,
  NAVIGATION_FAILURE_REASONS,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  ROUTER_ADAPTER_METHODS,
  SERVICE_NAME,
} from '../../lib/constants.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
const service = manifest.provides.find((entry) => entry.name === SERVICE_NAME);

test('should_export_plugin_identity_when_constants_are_loaded', () => {
  assert.equal(PLUGIN_NAME, manifest.name);
  assert.equal(PLUGIN_VERSION, manifest.version);
});

test('should_export_service_name_when_constants_are_loaded', () => {
  assert.equal(SERVICE_NAME, manifest.provides[0].name);
});

test('should_match_declared_events_when_contract_constants_are_loaded', () => {
  const eventNames = Object.values(EVENT_NAMES);
  assert.deepEqual(eventNames, manifest.events.map((event) => event.name));
});

test('should_match_declared_error_codes_when_contract_constants_are_loaded', () => {
  const errorCodes = Object.values(ERROR_CODES);
  const declaredErrors = new Set(service.methods.flatMap((method) => method.errors));
  assert.deepEqual(new Set(errorCodes), declaredErrors);
});

test('should_match_navigation_failure_reason_when_contract_constants_are_loaded', () => {
  const failureEvent = manifest.events.find((event) => event.name === EVENT_NAMES.NAVIGATION_FAILED);
  assert.equal(failureEvent.data.find((field) => field.name === 'reason').type.includes(NAVIGATION_FAILURE_REASONS.ROUTE_NOT_FOUND), true);
});

test('should_match_adapter_methods_when_contract_constants_are_loaded', () => {
  assert.deepEqual(ROUTER_ADAPTER_METHODS, [
    'getCurrentPath',
    'pushEntry',
    'replaceEntry',
    'goBack',
    'goForward',
    'onExternalChange',
  ]);
});
