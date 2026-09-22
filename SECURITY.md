# Security

## Source publication is not service deployment

Publishing this repository does not make its development runtime suitable for internet deployment. The API and Vite frontend use loopback defaults.

- `live-loop-api` binds to `127.0.0.1` by default. Local privilege requires both a loopback socket peer and a local Host value; `Host: localhost` from a remote peer does not bypass the token gate.
- A non-loopback `LIVE_LOOP_API_HOST` requires an operator-set `LIVE_LOOP_API_TOKEN`; callers must use a Bearer token.
- Do not embed the token in Vite variables or browser bundles. Remote use requires a server-side authenticated gateway.
- The development launcher binds Vite to loopback unless `--lan` is explicitly selected. `--lan` exposes only the development frontend and is intended for a trusted LAN.
- STT uploads have ASGI and streaming byte limits plus an upload-time limit. Limits can be lowered with `LIVE_LOOP_MAX_STT_UPLOAD_BYTES` and `LIVE_LOOP_MAX_STT_UPLOAD_SECONDS`.

Do not publish the raw development API through port forwarding or an unauthenticated reverse proxy.

## Known local-cache advisory

The locked model stack includes DiskCache 5.6.3 through `llama-cpp-python` 0.3.23. At the 2026-09-23 check, PyPI's current DiskCache release was still 5.6.3 and the official OSV record for `GHSA-w8v5-vhqr-4h9v` marked all versions through 5.6.3 as affected, with no fixed version event. There is therefore no compatible upstream patch to apply. An attacker who can replace its local cache database may trigger unsafe pickle deserialization. No HTTP cache-database import/selection path was identified in this audit. Keep model/cache directories private, never load cache databases supplied by other users, and reassess this dependency when an upstream fix is available. This is a documented residual risk, not an all-dependencies-clear certification.
