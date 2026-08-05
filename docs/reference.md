# pey.router Reference

The authoritative contract is [`manifest.json`](../manifest.json). If this reference and the manifest disagree, the manifest wins.

## Purpose

`pey.router` provides client-side navigation, route registration, route matching, and current-route state through a replaceable Router adapter. It is an infrastructure plugin for Bonyan architecture `0.11`.

## Structure

- `manifest.json` - authoritative plugin contract.
- `index.js` - Bonyan `prepare` and `activate` entry points.
- `lib/` - routing service, matching, path, error, constant, and adapter-loading logic.
- `adapters/` - technology-facing Router adapter implementations.
- `tests/` - unit, integration, lifecycle, manifest, and shared adapter-contract tests.
- `docs/` - complete plugin reference.
- `imp/` - requirements and implementation planning artifacts.

## Dependencies

- **Required:** None.
- **Optional:** None.

The plugin consumes the Router adapter selected by `bootstrap.json` through its `adapterType`, not another plugin service.

## Public API

The plugin provides `pey.router.service`. A consuming plugin must declare this exact service name in its own manifest dependencies before using it.

### `registerRoutes`

Registers route patterns cumulatively. Call it during the consuming plugin's local activation, after dependency binding. The complete batch is rejected without partial registration if any pattern is malformed.

```js
export async function activate(services) {
  const router = services['pey.router.service'];

  await router.registerRoutes([
    '/accounts',
    '/accounts/:id',
  ]);
}
```

### `navigate`

Pushes a new history entry. Query values may be strings, numbers, booleans, or `undefined`; `undefined` values are omitted. Put query data in `options.query`, not in `path`.

```js
await router.navigate('/accounts/42', {
  query: {
    tab: 'details',
    page: 2,
    archived: false,
    optional: undefined,
  },
});
```

If the path matches no registered pattern, the Promise still resolves successfully after the router falls back to `notFoundPath`.

### `replace`

Uses the same resolution rules as `navigate`, but replaces the current history entry.

```js
await router.replace('/accounts/42', {
  query: { tab: 'summary' },
});
```

### `back`

Requests movement to the previous history entry. It is a no-op when no previous entry exists. Route resolution occurs when the adapter reports the resulting path through `onExternalChange`.

```js
await router.back();
```

### `forward`

Requests movement to the next history entry. It is a no-op when no next entry exists.

```js
await router.forward();
```

### `getCurrentRoute`

Synchronously returns a defensive copy of the resolved current route.

```js
const route = router.getCurrentRoute();

// {
//   path: '/accounts/42',
//   pattern: '/accounts/:id',
//   params: { id: '42' },
//   query: { tab: 'details' },
//   isNotFound: false,
// }
```

Before application plugins finish registering routes, the current route may have `isNotFound: true`.

### `matchRoute`

Synchronously matches an arbitrary well-formed pattern without consulting the registered pattern set. Query data is ignored.

```js
const match = router.matchRoute('/accounts/:id', '/accounts/42?tab=details');

// { params: { id: '42' } }
```

A valid non-match returns `null`. A malformed pattern throws `ROUTER_MALFORMED_PATTERN` synchronously.

## Data Shapes

### `NavigateOptions`

```text
NavigateOptions {
  query?: Record<string, string | number | boolean | undefined>
}
```

`null`, arrays, and objects are invalid query values.

### `Route`

```text
Route {
  path: string
  pattern: string
  params: object
  query: object
  isNotFound: boolean
}
```

### `RouteMatch`

```text
RouteMatch {
  params: object
}
```

## Events

### `router:changed`

Published whenever the resolved active route changes through navigate, replace, back, forward, direct URL change, registration that resolves a prior fallback, or not-found fallback.

```js
{
  type: 'router:changed',
  data: { path: '/accounts/42' },
}
```

The payload contains only the resolved path relative to `basePath`. Call `getCurrentRoute()` for pattern, params, query, or `isNotFound`.

### `router:navigation-failed`

Published when a requested or reached path matches no registered route and fallback begins.

```js
{
  type: 'router:navigation-failed',
  data: {
    path: '/missing',
    reason: 'ROUTE_NOT_FOUND',
  },
}
```

For unmatched navigation, `router:navigation-failed` is published before `router:changed` for `notFoundPath`. Query values are excluded from both event payloads.

## Errors Reference

### Service Errors

| Code | Type | Situation |
|---|---|---|
| `ROUTER_MALFORMED_PATH` | Operational | `navigate` or `replace` receives an invalid path or invalid query value. |
| `ROUTER_MALFORMED_PATTERN` | Operational | `registerRoutes` receives a malformed pattern, or `matchRoute` is called with one. |
| `ROUTER_NAVIGATION_FAILED` | Operational | The adapter fails a push, replace, back, or forward operation. |

`registerRoutes`, `navigate`, `replace`, `back`, and `forward` reject their Promises on failure. `matchRoute` is synchronous and throws its listed error directly.

### Runtime Critical Errors

| Code | Type | Situation |
|---|---|---|
| `ROUTER_EXTERNAL_CHANGE_FAILED` | Critical | Processing a path from `onExternalChange` fails, including inability to replace an unmatched entry with `notFoundPath`. Reported to the Core through `reportCriticalError`, not returned by a service method. |

### Startup And Adapter Errors

| Code | Type | Situation |
|---|---|---|
| `ROUTER_ADAPTER_NOT_FOUND` | Startup | The configured adapter identifier is unsupported. |
| `ROUTER_ADAPTER_INVALID` | Startup | The loaded adapter does not implement all required Router methods. |
| `ROUTER_ADAPTER_INITIALIZATION_FAILED` | Startup | Loading or creating the configured adapter fails. |
| `ROUTER_ADAPTER_UNAVAILABLE` | Startup | The Browser History API is unavailable. |
| `ROUTER_ADAPTER_OPERATION_FAILED` | Operational | A raw Browser History API or event-listener operation fails. Adapter errors consumed by public navigation methods are normalized to `ROUTER_NAVIGATION_FAILED`. |
| `SERVICE_UNAVAILABLE` | Operational | A stale service reference is called after plugin deactivation. |

All errors crossing an adapter or plugin boundary use the standard Bonyan error structure. Raw browser errors, stack traces, paths containing query data, and other sensitive details are not propagated.

## Config

| Key | Type | Required | Default | Meaning |
|---|---|---|---|---|
| `basePath` | `string` | No | `/` | Deployment path prefix added before adapter writes and removed after adapter reads. |
| `notFoundPath` | `string` | No | `/not-found` | Terminal fallback sentinel used when no registered pattern matches. |

Both values must be valid absolute paths.

## Adapter Selection

The manifest declares `adapterType: "router"`, so the project must configure a Router adapter in `bootstrap.json`. The included web implementation is `BrowserHistoryAdapter`.

```json
{
  "adapters": {
    "router": "BrowserHistoryAdapter"
  },
  "config": {
    "pey.router": {
      "basePath": "/",
      "notFoundPath": "/not-found"
    }
  }
}
```

Every Router adapter must implement exactly these shared methods:

- `getCurrentPath`
- `pushEntry`
- `replaceEntry`
- `goBack`
- `goForward`
- `onExternalChange`

## Business Rules

- Route parameters use the fixed `:paramName` segment syntax.
- Registration is cumulative, duplicate patterns are ignored, and a malformed batch causes no partial mutation.
- Registered patterns and all service-facing paths are relative to `basePath`.
- Paths read from outside `basePath` use the not-found fallback.
- `notFoundPath` is a terminal sentinel; it is never rematched against registered patterns.
- Unmatched navigation is a routing outcome, not a caller-facing operational error.
- Push and replace are resolved synchronously from their adapter calls; back, forward, and external navigation are resolved only from `onExternalChange`.
- A successful back or forward path change produces exactly one external-change notification; a no-op produces none.
- Query values are available through `getCurrentRoute`, never through the Event Bus.
- The current `Route` is returned as a defensive copy.
- Service calls through stale references fail after deactivation.

## Constraints

- Do not call `registerRoutes` during preparation. Consumers receive service references only after dependency binding.
- Do not include query strings directly in the `path` argument to `navigate` or `replace`; use `options.query`.
- Do not use regex, `{param}`, wildcard, or parenthesized route-pattern syntax.
- Do not use this plugin for authorization or access-control decisions.
- Do not use this plugin for visual transitions, page rendering, product-specific deep-link rules, server-side routing, or server-side rendering.
- Route ownership and route removal on owner deactivation are not implemented in version `1.0.0`.
