// Verifies router service behavior through its public service contract.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouterService } from '../../lib/router-service.js';
import { createInMemoryRouterAdapter } from '../fakes/in-memory-router-adapter.js';

function createService(initialPath = '/') {
  const events = [];
  const adapter = createInMemoryRouterAdapter(initialPath);
  const router = createRouterService({
    adapter,
    basePath: '/',
    notFoundPath: '/not-found',
    publish: (type, data) => events.push({ type, data }),
  });

  events.length = 0;
  return { adapter, events, ...router };
}

test('should_expose_only_manifest_methods_when_service_is_created', () => {
  const { service } = createService();

  assert.deepEqual(Object.keys(service), [
    'registerRoutes',
    'navigate',
    'replace',
    'back',
    'forward',
    'getCurrentRoute',
    'matchRoute',
  ]);
});

test('should_register_routes_when_patterns_are_valid', async () => {
  const { service } = createService();

  await service.registerRoutes(['/accounts', '/accounts/:id']);

  assert.equal(service.getCurrentRoute().isNotFound, true);
});

test('should_accumulate_routes_when_register_routes_is_called_multiple_times', async () => {
  const { adapter, service } = createService('/accounts/42');

  await service.registerRoutes(['/accounts']);
  await service.registerRoutes(['/accounts/:id']);

  assert.deepEqual(service.getCurrentRoute(), {
    path: '/accounts/42',
    pattern: '/accounts/:id',
    params: { id: '42' },
    query: {},
    isNotFound: false,
  });
  assert.equal(adapter.getCurrentPath(), '/accounts/42');
});

test('should_reject_malformed_patterns_without_partial_registration', async () => {
  const { adapter, service } = createService('/accounts');

  await assert.rejects(service.registerRoutes(['/valid', '/invalid/']), {
    code: 'ROUTER_MALFORMED_PATTERN',
  });
  await service.navigate('/valid');

  assert.equal(adapter.getCurrentPath(), '/not-found');
  assert.equal(service.getCurrentRoute().isNotFound, true);
});

test('should_publish_changed_when_registration_resolves_not_found_route', async () => {
  const { events, service } = createService('/accounts/42');

  await service.registerRoutes(['/accounts/:id']);

  assert.deepEqual(events, [{ type: 'router:changed', data: { path: '/accounts/42' } }]);
});

test('should_navigate_and_publish_matched_route_when_path_matches', async () => {
  const { adapter, events, service } = createService();
  await service.registerRoutes(['/accounts/:id']);
  events.length = 0;

  const result = await service.navigate('/accounts/42', { query: { tab: 'details', page: 2 } });

  assert.equal(result, undefined);
  assert.equal(adapter.getCurrentPath(), '/accounts/42?tab=details&page=2');
  assert.deepEqual(service.getCurrentRoute(), {
    path: '/accounts/42',
    pattern: '/accounts/:id',
    params: { id: '42' },
    query: { tab: 'details', page: '2' },
    isNotFound: false,
  });
  assert.deepEqual(events, [{ type: 'router:changed', data: { path: '/accounts/42' } }]);
});

test('should_replace_history_entry_when_replace_is_called', async () => {
  const { adapter, service } = createService('/first');
  await service.registerRoutes(['/first', '/second']);

  await service.replace('/second');
  await service.back();

  assert.equal(adapter.getCurrentPath(), '/second');
});

test('should_fallback_and_publish_events_when_navigation_is_unmatched', async () => {
  const { adapter, events, service } = createService();
  await service.registerRoutes(['/accounts']);
  events.length = 0;

  await service.navigate('/missing', { query: { secret: 'value' } });

  assert.equal(adapter.getCurrentPath(), '/not-found');
  assert.deepEqual(service.getCurrentRoute(), {
    path: '/not-found',
    pattern: '/not-found',
    params: {},
    query: {},
    isNotFound: true,
  });
  assert.deepEqual(events, [
    {
      type: 'router:navigation-failed',
      data: { path: '/missing', reason: 'ROUTE_NOT_FOUND' },
    },
    { type: 'router:changed', data: { path: '/not-found' } },
  ]);
});

test('should_not_rematch_not_found_sentinel_when_sentinel_is_registered', async () => {
  const { events, service } = createService();
  await service.registerRoutes(['/not-found']);
  events.length = 0;

  await service.navigate('/missing');

  assert.equal(service.getCurrentRoute().isNotFound, true);
  assert.deepEqual(events.map((event) => event.type), [
    'router:navigation-failed',
    'router:changed',
  ]);
});

test('should_resolve_back_and_forward_from_external_change_signal', async () => {
  const { adapter, events, service } = createService('/one');
  await service.registerRoutes(['/one', '/two']);
  await service.navigate('/two');
  events.length = 0;

  await service.back();
  assert.equal(service.getCurrentRoute().path, '/one');
  await service.forward();
  assert.equal(service.getCurrentRoute().path, '/two');
  assert.deepEqual(events.map((event) => event.data.path), ['/one', '/two']);
});

test('should_fallback_when_external_path_is_outside_base_path', async () => {
  const events = [];
  const adapter = createInMemoryRouterAdapter('/app/accounts');
  const { service } = createRouterService({
    adapter,
    basePath: '/app',
    notFoundPath: '/not-found',
    publish: (type, data) => events.push({ type, data }),
  });
  events.length = 0;
  await service.registerRoutes(['/accounts']);

  adapter.simulateExternalChange('/other/page?tab=x');

  assert.equal(service.getCurrentRoute().isNotFound, true);
  assert.deepEqual(events.slice(-2), [
    {
      type: 'router:navigation-failed',
      data: { path: '/other/page', reason: 'ROUTE_NOT_FOUND' },
    },
    { type: 'router:changed', data: { path: '/not-found' } },
  ]);
});

test('should_preserve_route_when_external_fallback_replace_fails', async () => {
  const events = [];
  const adapter = createInMemoryRouterAdapter('/accounts');
  const { service } = createRouterService({
    adapter,
    basePath: '/',
    notFoundPath: '/not-found',
    publish: (type, data) => events.push({ type, data }),
  });
  await service.registerRoutes(['/accounts']);
  events.length = 0;
  adapter.replaceEntry = () => {
    throw new Error('replace failed');
  };

  assert.throws(
    () => adapter.simulateExternalChange('/missing'),
    { code: 'ROUTER_NAVIGATION_FAILED' },
  );
  assert.equal(service.getCurrentRoute().path, '/accounts');
  assert.deepEqual(events, []);
});

test('should_return_null_when_public_match_route_does_not_match', () => {
  const { service } = createService();

  assert.equal(service.matchRoute('/accounts/:id', '/users/42'), null);
});

test('should_reject_adapter_failure_when_navigation_operation_fails', async () => {
  const events = [];
  const adapter = createInMemoryRouterAdapter();
  adapter.pushEntry = () => {
    throw new Error('history failed');
  };
  const { service } = createRouterService({
    adapter,
    basePath: '/',
    notFoundPath: '/not-found',
    publish: (type, data) => events.push({ type, data }),
  });
  events.length = 0;
  await service.registerRoutes(['/accounts']);

  await assert.rejects(service.navigate('/accounts'), {
    code: 'ROUTER_NAVIGATION_FAILED',
  });
  assert.deepEqual(events, []);
});

test('should_reject_adapter_failure_when_back_or_forward_fails', async () => {
  const adapter = createInMemoryRouterAdapter();
  adapter.goBack = () => {
    throw new Error('back failed');
  };
  adapter.goForward = () => {
    throw new Error('forward failed');
  };
  const { service } = createRouterService({
    adapter,
    basePath: '/',
    notFoundPath: '/not-found',
    publish: () => {},
  });

  await assert.rejects(service.back(), { code: 'ROUTER_NAVIGATION_FAILED' });
  await assert.rejects(service.forward(), { code: 'ROUTER_NAVIGATION_FAILED' });
});

test('should_reject_malformed_path_when_query_value_is_invalid', async () => {
  const { service } = createService();
  await service.registerRoutes(['/accounts']);

  await assert.rejects(
    service.navigate('/accounts', { query: { filter: null } }),
    { code: 'ROUTER_MALFORMED_PATH' },
  );
});

test('should_return_route_copy_when_current_route_is_requested', async () => {
  const { service } = createService('/accounts/42?tab=details');
  await service.registerRoutes(['/accounts/:id']);
  const route = service.getCurrentRoute();

  route.params.id = 'changed';
  route.query.tab = 'changed';

  assert.deepEqual(service.getCurrentRoute().params, { id: '42' });
  assert.deepEqual(service.getCurrentRoute().query, { tab: 'details' });
});

test('should_reject_calls_when_service_is_deactivated', async () => {
  const { deactivate, service } = createService();
  deactivate();

  assert.throws(() => service.getCurrentRoute(), { code: 'SERVICE_UNAVAILABLE' });
  await assert.rejects(service.navigate('/accounts'), { code: 'SERVICE_UNAVAILABLE' });
});

test('should_remove_external_subscription_when_service_is_deactivated', () => {
  const adapter = createInMemoryRouterAdapter();
  const subscribe = adapter.onExternalChange.bind(adapter);
  let unsubscribeCount = 0;
  adapter.onExternalChange = (callback) => {
    const unsubscribe = subscribe(callback);
    return () => {
      unsubscribeCount += 1;
      unsubscribe();
    };
  };
  const { deactivate } = createRouterService({
    adapter,
    basePath: '/',
    notFoundPath: '/not-found',
    publish: () => {},
  });

  deactivate();

  assert.equal(unsubscribeCount, 1);
});
