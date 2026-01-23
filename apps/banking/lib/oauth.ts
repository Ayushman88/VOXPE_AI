import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface TokenPayload {
  userId: string;
  email?: string;
  clientId?: string;
  scopes?: string[];
  type?: string;
}

export function decodeOAuthToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function hasScope(token: string, requiredScope: string): boolean {
  const payload = decodeOAuthToken(token);
  if (!payload || !payload.scopes) {
    return false;
  }
  return payload.scopes.includes(requiredScope);
}

export function hasAnyScope(token: string, requiredScopes: string[]): boolean {
  const payload = decodeOAuthToken(token);
  if (!payload || !payload.scopes) {
    return false;
  }
  return requiredScopes.some(scope => payload.scopes!.includes(scope));
}

export function getScopes(token: string): string[] {
  const payload = decodeOAuthToken(token);
  return payload?.scopes || [];
}
