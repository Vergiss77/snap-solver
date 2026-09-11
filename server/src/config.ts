import path from "node:path";
import fs from "node:fs";

export interface ServerConfig {
  /** Listen port. Source: --port arg or PORT env, else default. */
  port: number;
  /** Data directory holding app.db and images/. Configurable via --data-dir or DATA_DIR. */
  dataDir: string;
  /** Absolute path of the built web frontend to serve, when it exists. */
  webDistDir: string;
}

export const DEFAULT_PORT = 17890;

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

export function loadConfig(): ServerConfig {
  const port = Number(argValue("--port") ?? process.env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  const dataDir = path.resolve(
    argValue("--data-dir") ?? process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
  );
  fs.mkdirSync(path.join(dataDir, "images"), { recursive: true });
  return {
    port,
    dataDir,
    webDistDir: path.resolve(process.cwd(), "web/dist"),
  };
}
