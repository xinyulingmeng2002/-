export type BridgeClientConfig = {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
};

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function createTokenHeaders(token: string): { authorization: string } {
  return {
    authorization: `Bearer ${token}`
  };
}

export function resolveBridgeUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}
