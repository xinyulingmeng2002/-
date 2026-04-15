export interface ServerConfig {
  host: string;
  port: number;
}

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsedPort = Number(env.PORT);

  return {
    host: env.HOST ?? DEFAULT_HOST,
    port: Number.isInteger(parsedPort) && parsedPort >= 0 ? parsedPort : DEFAULT_PORT
  };
}
