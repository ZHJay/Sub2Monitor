# Sub2Monitor

Sub2Monitor is a read-only usage dashboard for Sub2API. It presents cost, tokens, requests, per-model trends, and contribution heatmaps to authenticated administrators.

## Security boundary

Sub2Monitor delegates identity to the existing Sub2API SSO Bridge. It never collects passwords and does not persist upstream Sub2API tokens in browser storage.

The existing `apimonitor` cookie, event, and `postMessage` labels remain as compatibility contracts with the deployed Bridge; they are not product branding.

## Development

```bash
cd backend && go test ./... && go vet ./...
cd ../frontend && npm ci && npm test -- --run
```

For a source-built container image:

```bash
docker build -t sub2monitor .
```

`Dockerfile.runtime` is reserved for the production release workflow: it serves the versioned verified frontend release assets and matching ARM64 backend executable.

## Repository hygiene

Secrets, local environment files, transient build output, local worktrees, and agent scratch state are excluded from Git. The only checked-in release artifacts are the verified `frontend/dist` bundle and `backend/sub2monitor-linux-arm64` required by `Dockerfile.runtime`.
