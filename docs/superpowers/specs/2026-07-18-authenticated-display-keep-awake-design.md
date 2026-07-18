# Authenticated Display Keep-Awake Design

## Goal

Keep the Sub2Monitor dashboard visible and refreshing while an administrator session is valid. Release the screen wake lock and stop dashboard refreshes only after the application definitively detects authentication loss.

## Success criteria

- A successful `/api/auth/sso/session` check starts screen keep-awake behavior.
- While the dashboard remains visible, the browser holds a `screen` Wake Lock whenever the API is supported.
- If the browser releases the lock because the document becomes hidden, the dashboard reacquires it when the document becomes visible again and the admin session is still authenticated.
- Dashboard metrics refresh on a 30-second deadline without overlapping refresh executions.
- Returning to a visible/focused/online page triggers an immediate catch-up refresh when a deadline was missed.
- `401` or `403` authentication loss releases the Wake Lock and unmounts the dashboard, which stops its refresh scheduler.
- `503`, timeout, offline, and other transient failures retain the authenticated display policy and do not release the Wake Lock.
- Browsers without the Screen Wake Lock API continue refreshing normally without breaking the dashboard.

## Scope and browser boundary

This change is web-only. A foreground dashboard can prevent display sleep through the Screen Wake Lock API. Browsers and operating systems may freeze hidden tabs, so the application cannot guarantee a network request every 30 seconds while hidden. Instead, it preserves an absolute refresh deadline and performs an immediate catch-up refresh after visibility, focus, or connectivity returns.

The existing backend SSO contract remains unchanged. Because positive identity checks are cached for 45 seconds, an upstream logout is detected when a later Monitor request reaches identity revalidation and returns `401` or `403`.

## Architecture

### L0 公理层: authenticated display policy

A pure policy maps application conditions to actions:

| Condition | Wake Lock | Refresh scheduler |
|---|---|---|
| `authenticated` | acquire/retain | run |
| document hidden | browser may release; do not treat as logout | deadline retained |
| document visible again | reacquire if still authenticated | catch up if overdue |
| `401` / `403` | release | dashboard unmount stops scheduler |
| `503`, timeout, offline | retain | keep deadline and retry on cadence/resume |
| application unmount | release | stop and remove listeners |

### L1 积木层: `screenWakeLock`

A focused adapter wraps `navigator.wakeLock.request('screen')`.

Responsibilities:

- request at most one live sentinel;
- tolerate unsupported browsers and rejected requests;
- clear stale sentinels when the browser emits `release`;
- reacquire on `visibilitychange` only when the caller still marks the admin session active;
- explicitly release and remove listeners on stop.

Wake Lock acquisition failure is non-fatal. It must not alter authentication state or stop metrics refresh.

### L1 积木层: `refreshScheduler`

A deadline-based scheduler wraps one asynchronous refresh callback.

Responsibilities:

- maintain a 30-second absolute next deadline;
- serialize refresh execution so slow requests cannot overlap;
- schedule the next deadline after each completed attempt without accumulating timer drift;
- on `visibilitychange`, `focus`, or `online`, refresh immediately only when the deadline is overdue;
- remove timers and event listeners on stop.

The scheduler does not classify HTTP errors. The existing Axios interceptor remains the source of the `apimonitor:auth-lost` event for `401` and `403`.

### L2 流程层: authenticated display lifecycle

`App.vue` owns the authentication lifecycle and starts/stops the Wake Lock adapter according to `AuthenticationStatus`. `Dashboard.vue` remains mounted only while authenticated, so `useDashboardMetrics` owns the refresh scheduler lifecycle.

This keeps dependencies downward and local:

- `App.vue` authentication flow → Wake Lock adapter;
- `useDashboardMetrics` metrics flow → refresh scheduler;
- neither adapter imports Vue, Axios, or a higher-layer module.

No L3 外交层 addition is needed because the change does not coordinate multiple module-level L2 flows.

## Data and event flow

1. `App.vue` validates the existing Monitor SSO session.
2. On success, it marks the session authenticated, mounts `Dashboard`, and starts the screen Wake Lock lifecycle.
3. `useDashboardMetrics` starts the deadline scheduler, which performs the initial metrics refresh and records the next deadline.
4. Normal 30-second deadlines call the existing `refreshData` orchestration.
5. Visibility/focus/online recovery checks the deadline and performs one catch-up refresh if overdue.
6. Any API response with `401` or `403` dispatches `apimonitor:auth-lost`.
7. `App.vue` moves to anonymous, releases the Wake Lock, and unmounts `Dashboard`; unmounting stops refresh scheduling.
8. `503` and network failures remain errors inside the current dashboard flow and do not change authentication or keep-awake state.

## Error handling

- Unsupported Wake Lock API: no-op adapter; dashboard remains usable.
- Wake Lock request rejected: retain active intent and retry on the next visible transition; do not surface an auth error.
- Wake Lock released by browser: clear the sentinel; reacquire only when the page is visible and admin intent remains active.
- Refresh callback rejects: complete that scheduler cycle, keep a future deadline, and let existing dashboard error state report the failure.
- Stop during an in-flight refresh: do not schedule another timer after the callback settles.
- Multiple resume events: in-flight serialization collapses them into at most one active refresh.

## Testing

### Wake Lock adapter

- acquires when started in a visible document;
- does not duplicate acquisition;
- reacquires after a browser release and visible transition;
- releases on stop/authentication loss;
- does not reacquire after stop;
- degrades cleanly when API is absent or request rejects.

### Refresh scheduler

- performs the initial refresh;
- refreshes on each 30-second deadline;
- never overlaps a slow refresh;
- catches up once after an overdue visibility/focus/online recovery;
- does not catch up before the deadline;
- stops timers and listeners after unmount.

### Integration checks

- authenticated `App.vue` starts keep-awake behavior;
- `apimonitor:auth-lost` stops it and shows the login gate;
- transient `503` does not emit auth loss;
- frontend unit tests, type checking, and production build pass.

## Non-goals

- Changing Sub2API logout, Monitor cookies, SSO Bridge labels, or the 45-second positive identity cache.
- Adding a native macOS `caffeinate` or kiosk launcher.
- Promising background network execution while the browser or operating system has frozen the tab.
- Adding user-facing controls for disabling keep-awake; authenticated display mode is automatic by requirement.
