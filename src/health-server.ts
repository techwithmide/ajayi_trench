import http from "node:http";

export type HealthServer = {
  readonly port: number;
  close: () => Promise<void>;
};

/**
 * Tiny HTTP listener for load balancers / uptime checks.
 * Set HEALTH_PORT=0 to disable.
 */
export function startHealthServer(): HealthServer | null {
  const raw = process.env.HEALTH_PORT ?? "8080";
  const port = parseInt(raw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  const host = process.env.HEALTH_HOST ?? "0.0.0.0";

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url?.split("?")[0] === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          ok: true,
          uptimeSec: Math.floor(process.uptime()),
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, host);

  return {
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
