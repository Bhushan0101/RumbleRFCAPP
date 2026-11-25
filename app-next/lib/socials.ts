// Resolve fighter-supplied social handles into safe profile URLs.
// Accepts either a bare handle ("@wuco", "wuco") or a full URL.

function clean(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/\/+$/, "");
}

function safeAbsolute(raw: string, allowedHosts: string[]): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function instagramUrl(input: string): string | null {
  const raw = clean(input);
  if (!raw) return null;
  if (raw.startsWith("http")) return safeAbsolute(raw, ["instagram.com"]);
  // Handle should be username-safe chars only.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) return null;
  return `https://www.instagram.com/${raw}/`;
}

export function tiktokUrl(input: string): string | null {
  const raw = clean(input);
  if (!raw) return null;
  if (raw.startsWith("http")) return safeAbsolute(raw, ["tiktok.com"]);
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) return null;
  return `https://www.tiktok.com/@${raw}`;
}

export function facebookUrl(input: string): string | null {
  const raw = clean(input);
  if (!raw) return null;
  if (raw.startsWith("http")) return safeAbsolute(raw, ["facebook.com", "fb.com"]);
  if (!/^[A-Za-z0-9.]{3,60}$/.test(raw)) return null;
  return `https://www.facebook.com/${raw}`;
}
