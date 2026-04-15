export interface ServerConfig {
  host: string;
  port: number;
  dataDir: string;
  uploadsPublicBasePath: string;
}

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;
const DEFAULT_UPLOADS_PUBLIC_BASE_PATH = "/uploads";

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_UPLOADS_PUBLIC_BASE_PATH;
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "") || DEFAULT_UPLOADS_PUBLIC_BASE_PATH;
}

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsedPort = Number(env.PORT);

  return {
    host: env.HOST ?? DEFAULT_HOST,
    port: Number.isInteger(parsedPort) && parsedPort >= 0 ? parsedPort : DEFAULT_PORT,
    dataDir: env.DATA_DIR ?? process.cwd(),
    uploadsPublicBasePath: normalizeBasePath(
      env.UPLOADS_PUBLIC_BASE_PATH ?? DEFAULT_UPLOADS_PUBLIC_BASE_PATH
    )
  };
}
