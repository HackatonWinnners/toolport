export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

export function isRequest(value: unknown): value is JsonRpcRequest {
  return !!value && typeof value === "object" && typeof (value as any).method === "string";
}

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

/**
 * Pull the JSON-RPC response for `id` out of an upstream reply, which per Streamable HTTP
 * may be plain JSON or an SSE stream (`data: {...}` events).
 */
export function findResponse(body: string, contentType: string | null, id: JsonRpcId): JsonRpcResponse | null {
  const candidates: unknown[] = [];
  if (contentType?.includes("text/event-stream")) {
    for (const event of body.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      if (!data) continue;
      try {
        candidates.push(JSON.parse(data));
      } catch {
        // ignore keep-alives and partial events
      }
    }
  } else {
    try {
      const parsed = JSON.parse(body);
      candidates.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      return null;
    }
  }
  for (const message of candidates) {
    const m = message as JsonRpcResponse;
    if (m && typeof m === "object" && m.id === id && ("result" in m || "error" in m)) return m;
  }
  return null;
}
