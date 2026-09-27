/**
 * Google sign-in as IDENTITY only (scopes: openid email profile). Deliberately does NOT
 * request Gmail scopes: reading mail is a "restricted" Google scope requiring a security
 * assessment, and inbox access is far more than this app needs. No Google tokens are stored.
 * Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI.
 *
 * ID-token verification here uses Google's tokeninfo endpoint (Google documents it for
 * validation); for high volume, switch to local JWKS verification.
 */
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function buildAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeForIdentity(code: string): Promise<{ sub: string; email: string }> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) throw new Error("No id_token returned");

  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
  if (!infoRes.ok) throw new Error("id_token failed validation");
  const info = (await infoRes.json()) as { aud: string; sub: string; email?: string; email_verified?: string | boolean };
  if (info.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("id_token audience mismatch");
  if (!info.email || String(info.email_verified) !== "true") throw new Error("Google email is not verified");
  return { sub: info.sub, email: info.email };
}
