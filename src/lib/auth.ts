import { cookies } from "next/headers";

const SESSION_COOKIE = "ae_session";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(session.value, "base64").toString("utf-8")
    );
    return payload.authenticated === true && payload.expires > Date.now();
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  const payload = {
    authenticated: true,
    expires: Date.now() + SESSION_DURATION,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export { SESSION_COOKIE, SESSION_DURATION };
