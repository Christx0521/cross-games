// Steam usa OpenID 2.0 (no OAuth2). El login no requiere clave de API.
// Aquí las partes puras (construir URL, extraer steamid, armar verificación)
// quedan separadas de la red para poder probarlas sin tocar internet.

const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID_RE = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

// URL a la que redirigir al usuario para iniciar sesión en Steam.
export function buildLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    "openid.ns": NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

// Extrae el SteamID64 del claimed_id devuelto por Steam.
export function extractSteamId(claimedId: string | undefined): string | null {
  if (!claimedId) return null;
  const m = CLAIMED_ID_RE.exec(claimedId);
  return m ? m[1]! : null;
}

// Cuerpo para reenviar a Steam con mode=check_authentication.
export function buildVerificationBody(query: Record<string, string | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("openid.") && value !== undefined) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");
  return body;
}

export type VerifyFetch = (body: URLSearchParams) => Promise<string>;

const defaultVerifyFetch: VerifyFetch = async (body) => {
  const res = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.text();
};

// Verifica el callback contra Steam y devuelve el SteamID64 si es válido.
export async function verifyCallback(
  query: Record<string, string | undefined>,
  verifyFetch: VerifyFetch = defaultVerifyFetch
): Promise<string | null> {
  const steamId = extractSteamId(query["openid.claimed_id"]);
  if (!steamId) return null;
  const text = await verifyFetch(buildVerificationBody(query));
  return /is_valid\s*:\s*true/.test(text) ? steamId : null;
}
