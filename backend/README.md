# Sub2Monitor Backend

Monitor uses a short-lived, server-side session to query Sub2API usage metrics. It never accepts a password, stores a browser JWT, or requires Sub2API's signing secret.

## Authentication design

1. The Monitor frontend requests a one-time SSO challenge.
2. A same-origin Bridge at `api4kimi8.org` reads the existing Sub2API access token and transfers it only in memory through a fixed-origin `postMessage`.
3. Monitor exchanges it once against the Docker-private `http://sub2api:8080/api/v1/auth/me` authority.
4. Only an `active` user with role `admin` receives a 15-minute `__Host-` HttpOnly session. Every metric request rechecks `/auth/me`.

`/api/auth/login` and `/api/auth/verify` intentionally do not exist.

## Environment

```text
DB_HOST=sub2api-postgres
DB_PORT=5432
DB_USER=monitor_readonly
DB_PASSWORD=...
DB_NAME=sub2api
DB_SSLMODE=disable
SERVER_PORT=8090
GIN_MODE=release
```

## Routes

- `GET /health`
- `POST /api/auth/sso/challenge`
- `POST /api/auth/sso/exchange`
- `POST /api/auth/sso/logout`
- `GET /api/metrics/{summary,timeseries,by-model}`
- `GET /internal/sso/bridge{,.js}` (only when proxied with Host `api4kimi8.org`)

Run `go test ./...`, `go vet ./...`, and `go build ./cmd/server` before release.
