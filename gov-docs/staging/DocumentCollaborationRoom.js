// Staging only: authenticated Yjs update transport. Not production-deployed.
// Yjs updates are opaque Uint8Array payloads; clients must merge using Y.applyUpdate.
// The frontend worker MUST authenticate, check docAccess and pass a short-lived
// HMAC signed document/role token before connecting to this Durable Object.
export class DocumentCollaborationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    // Never expose this Durable Object directly without a validating Worker gateway.
    if (request.headers.get('X-Internal-Authorized') !== '1')
      return new Response('Unauthorized', { status: 403 });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(socket, message) {
    // Protocol: 0x01 Yjs update; 0x02 awareness; 0x03 state request.
    // 64KiB max frame. Segmented state sync and durable snapshots must be
    // implemented and tested before enabling for real users.
    if (!(message instanceof ArrayBuffer) || message.byteLength > 65536) {
      socket.send(JSON.stringify({ error: 'invalid frame' }));
      return;
    }
    for (const peer of this.state.getWebSockets()) {
      if (peer !== socket) peer.send(message);
    }
  }
  async webSocketClose(socket, code, reason, wasClean) {
    try { socket.close(code, reason); } catch {}
  }
  async webSocketError(socket) {
    try { socket.close(1011, 'Transport error'); } catch {}
  }
}
