import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { MetricsRegistry } from "./metrics.registry";

export type ObservabilityHttpRequest = {
  method?: string;
  url?: string;
};

export type ObservabilityHttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export function createObservabilityHttpServer(
  metricsRegistry: MetricsRegistry,
): Server {
  return createServer((request, response) => {
    void writeResponse(metricsRegistry, request, response);
  });
}

export async function handleObservabilityHttpRequest(
  metricsRegistry: MetricsRegistry,
  request: ObservabilityHttpRequest,
): Promise<ObservabilityHttpResponse> {
  if (request.method !== "GET") {
    return textResponse(405, "method not allowed");
  }

  const path = new URL(request.url ?? "/", "http://localhost").pathname;

  if (path === "/health") {
    return jsonResponse(200, { status: "ok" });
  }

  if (path === "/metrics") {
    return {
      statusCode: 200,
      headers: { "Content-Type": metricsRegistry.contentType },
      body: await metricsRegistry.metrics(),
    };
  }

  return textResponse(404, "not found");
}

async function writeResponse(
  metricsRegistry: MetricsRegistry,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const result = await handleObservabilityHttpRequest(
      metricsRegistry,
      request,
    );
    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch {
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }

    response.end("internal server error");
  }
}

function jsonResponse(
  statusCode: number,
  body: unknown,
): ObservabilityHttpResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function textResponse(
  statusCode: number,
  body: string,
): ObservabilityHttpResponse {
  return {
    statusCode,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body,
  };
}
