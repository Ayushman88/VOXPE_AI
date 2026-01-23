/**
 * OAuth2 Authorization Endpoint
 * 
 * SAIF Principle: Safety
 * - User authorizes AI agent through banking app
 * - No credentials shared with AI agent
 * - Scoped permissions
 */

import { NextRequest, NextResponse } from "next/server";
import { db, PrismaClient } from "@voxpe/db-banking";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const AI_AGENT_CLIENT_ID = "ai-agent";
const AI_AGENT_REDIRECT_URI = "http://localhost:3000/auth/callback";

// Valid scopes
const VALID_SCOPES = ["payments", "read_balance", "read_transactions", "read_beneficiaries"];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");
    const redirectUri = searchParams.get("redirect_uri");
    const responseType = searchParams.get("response_type");
    const scope = searchParams.get("scope");
    const state = searchParams.get("state");
    const codeChallenge = searchParams.get("code_challenge");
    const codeChallengeMethod = searchParams.get("code_challenge_method");

    const origin = new URL(request.url).origin;

    // Validate OAuth2 parameters
    if (responseType !== "code") {
      return NextResponse.redirect(
        new URL(`/login?error=unsupported_response_type&state=${state || ""}`, origin)
      );
    }

    if (clientId !== AI_AGENT_CLIENT_ID) {
      return NextResponse.redirect(
        new URL(`/login?error=invalid_client&state=${state || ""}`, origin)
      );
    }

    if (redirectUri !== AI_AGENT_REDIRECT_URI) {
      return NextResponse.redirect(
        new URL(`/login?error=invalid_redirect_uri&state=${state || ""}`, origin)
      );
    }

    // Parse and validate scopes
    const requestedScopes = scope ? scope.split(" ").filter(s => VALID_SCOPES.includes(s)) : [];
    if (requestedScopes.length === 0) {
      return NextResponse.redirect(
        new URL(`/login?error=invalid_scope&state=${state || ""}`, origin)
      );
    }

    // Check if user is already logged in (via cookie)
    // In Next.js API routes, use request.cookies directly
    const tokenCookie = request.cookies.get("token");
    let userId: string | null = null;

    console.log("🔐 [OAuth Authorize] ========== AUTHORIZE REQUEST ==========");
    console.log("🔐 [OAuth Authorize] Request URL:", request.url);
    console.log("🔐 [OAuth Authorize] Request method:", request.method);
    console.log("🔐 [OAuth Authorize] Has token cookie:", !!tokenCookie);
    console.log("🔐 [OAuth Authorize] Token cookie value:", tokenCookie ? tokenCookie.value.substring(0, 20) + "..." : "none");
    console.log("🔐 [OAuth Authorize] All cookies:", request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 20)}...`));
    console.log("🔐 [OAuth Authorize] Cookie header:", request.headers.get("cookie")?.substring(0, 100));

    if (tokenCookie) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
        const decoded = jwt.verify(tokenCookie.value, JWT_SECRET) as { userId: string; email?: string };
        userId = decoded.userId;
        console.log("✅ [OAuth Authorize] User authenticated:", userId);
      } catch (error: any) {
        console.log("❌ [OAuth Authorize] Invalid token:", error.message);
        // Invalid token, user needs to login
      }
    } else {
      console.log("⚠️ [OAuth Authorize] No token cookie found");
    }

    // If user is not logged in, redirect to login with return URL
    if (!userId) {
      console.log("🔐 [OAuth Authorize] User not authenticated, redirecting to login");
      console.log("🔐 [OAuth Authorize] This might be a cookie issue - check if cookie is being sent");
      const origin = new URL(request.url).origin;
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("redirect", `/api/auth/authorize?${searchParams.toString()}`);
      console.log("🔐 [OAuth Authorize] Redirecting to login:", loginUrl.toString());
      return NextResponse.redirect(loginUrl);
    }

    console.log("🔐 [OAuth Authorize] User is authenticated, generating authorization code");
    
    // Debug DB object
    console.log("🔐 [OAuth Authorize] DB object keys:", Object.keys(db).filter(k => !k.startsWith('_')));
    // NOTE: Prisma converts model names to camelCase, so OAuthAuthorization becomes oAuthAuthorization
    // @ts-ignore
    console.log("🔐 [OAuth Authorize] Has oAuthAuthorization on global db:", !!db.oAuthAuthorization);

    // Use the db instance - it should have oAuthAuthorization (camelCase)
    const prisma: any = db;
    
    // @ts-ignore - Check if oAuthAuthorization exists (note the capital O and A)
    const hasOAuthModel = db.oAuthAuthorization !== undefined;
    console.log("🔐 [OAuth Authorize] Checking if oAuthAuthorization model exists:", hasOAuthModel);
    
    if (!hasOAuthModel) {
      console.error("❌ [OAuth Authorize] oAuthAuthorization model not found on Prisma client!");
      throw new Error("Prisma client does not have oAuthAuthorization model. The model name is case-sensitive: use 'oAuthAuthorization' (capital O and A).");
    }

    // User is logged in, show authorization page
    // For now, we'll auto-approve and generate authorization code
    // In production, show a consent page first

    // Generate authorization code
    const authorizationCode = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("🔐 [OAuth Authorize] Generating authorization code for user:", userId);
    console.log("🔐 [OAuth Authorize] Scopes:", requestedScopes);

    // Store authorization code
    try {
      // Use oAuthAuthorization (camelCase - capital O and A) as Prisma converts model names
      const authRecord = await prisma.oAuthAuthorization.create({
        data: {
          userId,
          clientId: AI_AGENT_CLIENT_ID,
          authorizationCode,
          scopes: JSON.stringify(requestedScopes),
          redirectUri: AI_AGENT_REDIRECT_URI,
          codeChallenge: codeChallenge || null,
          codeChallengeMethod: codeChallengeMethod || null,
          expiresAt,
        },
      });
      console.log("✅ [OAuth Authorize] Authorization code created:", authorizationCode);
    } catch (dbError: any) {
      console.error("❌ [OAuth Authorize] Database error creating authorization:", dbError);
      console.error("❌ [OAuth Authorize] Error message:", dbError.message);
      console.error("❌ [OAuth Authorize] Error code:", dbError.code);
      console.error("❌ [OAuth Authorize] Prisma client type:", typeof prisma);
      console.error("❌ [OAuth Authorize] Prisma client has oauthAuthorization:", !!prisma.oauthAuthorization);
      
      // If table doesn't exist, provide helpful error
      if (dbError.code === "P2021" || dbError.message?.includes("does not exist")) {
        throw new Error("OAuth authorization table not found. Please run database migration: npx prisma migrate dev");
      }
      
      // If it's the undefined error, provide specific instructions
      if (dbError.message?.includes("Cannot read properties of undefined") || dbError.message?.includes("reading 'create'")) {
        throw new Error("Prisma client is stale. Please restart the Next.js development server (Ctrl+C and run 'npm run dev' again) to pick up the regenerated Prisma client.");
      }
      
      throw dbError;
    }

    // Redirect back to AI agent with authorization code
    const callbackUrl = new URL(AI_AGENT_REDIRECT_URI);
    callbackUrl.searchParams.set("code", authorizationCode);
    if (state) {
      callbackUrl.searchParams.set("state", state);
    }

    const finalCallbackUrl = callbackUrl.toString();
    console.log("🔐 [OAuth Authorize] ========== SUCCESS - REDIRECTING TO CALLBACK ==========");
    console.log("🔐 [OAuth Authorize] Redirecting to callback:", finalCallbackUrl);
    console.log("🔐 [OAuth Authorize] Callback URL is absolute:", callbackUrl.protocol === "http:" || callbackUrl.protocol === "https:");
    console.log("🔐 [OAuth Authorize] Authorization code:", authorizationCode.substring(0, 10) + "...");
    
    // Use 302 redirect (temporary) for OAuth flow
    // NextResponse.redirect with a URL object should work, but let's be explicit
    const redirectResponse = NextResponse.redirect(finalCallbackUrl, { status: 302 });
    
    // Verify the redirect was set correctly
    const locationHeader = redirectResponse.headers.get("location");
    console.log("🔐 [OAuth Authorize] Redirect response created");
    console.log("🔐 [OAuth Authorize] Status code:", redirectResponse.status);
    console.log("🔐 [OAuth Authorize] Location header:", locationHeader);
    
    if (!locationHeader || locationHeader !== finalCallbackUrl) {
      console.error("❌ [OAuth Authorize] Location header mismatch!");
      console.error("❌ [OAuth Authorize] Expected:", finalCallbackUrl);
      console.error("❌ [OAuth Authorize] Got:", locationHeader);
    } else {
      console.log("✅ [OAuth Authorize] Redirect header set correctly!");
    }
    
    return redirectResponse;
  } catch (error: any) {
    console.error("❌ [OAuth Authorize] Authorization error:", error);
    console.error("❌ [OAuth Authorize] Error stack:", error.stack);
    const origin = new URL(request.url).origin;
    
    // If it's a database error, provide more details
    if (error.message?.includes("OAuth authorization table")) {
      console.error("❌ [OAuth Authorize] Database migration needed!");
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=server_error&message=${encodeURIComponent(error.message || "Unknown error")}`, origin)
    );
  }
}

