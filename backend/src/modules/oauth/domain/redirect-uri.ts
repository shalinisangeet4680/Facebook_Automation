const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

export function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

export function isRegistrableRedirect(uri: string): boolean {
  const url = parse(uri);
  if (!url || url.hash) return false;
  if (url.protocol === "https:") return true;
  return isLoopback(url);
}

export function matchesRedirect(
  registered: string[],
  requested: string,
): boolean {
  if (registered.includes(requested)) return true;
  const target = parse(requested);
  if (!target || !isLoopback(target)) return false;
  return registered.some((uri) => {
    const candidate = parse(uri);
    return (
      !!candidate &&
      isLoopback(candidate) &&
      candidate.hostname === target.hostname &&
      candidate.pathname === target.pathname &&
      candidate.search === target.search
    );
  });
}
