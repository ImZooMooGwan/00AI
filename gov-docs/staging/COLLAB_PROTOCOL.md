# Staging WebSocket protocol
The prototype transports opaque Yjs update/awareness frames. It does **not** persist Y.Doc and does not replay history.
Do not deploy it to production without:
- secure upgrade gateway + signed session permissions, prohibit spoofable authorization header
- document state snapshot and durable update journal
- awareness cleanup, WebSocket reconnect and state vector sync
- document ACL revalidation after membership change
- batching, rate limit, load test and negative authentication tests.
Use Cloudflare Durable Objects isolated staging namespace, not the existing production Worker.
