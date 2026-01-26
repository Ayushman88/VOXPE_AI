import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { decodeOAuthToken, hasAnyScope } from "./oauth";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthUser {
  userId: string;
  email: string;
}

export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    // 1. Try Authorization header (for AI Agent / API calls)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = decodeOAuthToken(token);
      
      if (payload) {
        // If it's an OAuth token, ensure it has necessary permissions
        if (payload.type === "oauth_access_token") {
          // Bill payments and previews usually need 'payments' or 'write' scope
          if (!hasAnyScope(token, ["payments", "write", "read_balance"])) {
            return null;
          }
        }
        
        return {
          userId: payload.userId,
          email: payload.email || "",
        };
      }
    }

    // 2. Try Cookies (for direct web app usage)
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    return null;
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("token")?.value || null;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
