/**
 * OAuth2 Token Exchange Endpoint
 * 
 * SAIF Principle: Safety
 * - Exchanges authorization code for access token
 * - Validates PKCE if provided
 * - Returns scoped access token
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const AI_AGENT_CLIENT_ID = "ai-agent";
const AI_AGENT_REDIRECT_URI = "http://localhost:3000/auth/callback";

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "http://localhost:3000");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  console.log("🔐 [Token Exchange] CORS preflight request");
  const response = new NextResponse(null, { status: 204 });
  addCorsHeaders(response);
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔐 [Token Exchange] ========== TOKEN EXCHANGE REQUEST ==========");
    console.log("🔐 [Token Exchange] Request origin:", request.headers.get("origin"));
    console.log("🔐 [Token Exchange] Request URL:", request.url);
    
    const { grant_type, code, redirect_uri, code_verifier, client_id } = await request.json();
    
    console.log("🔐 [Token Exchange] Grant type:", grant_type);
    console.log("🔐 [Token Exchange] Code:", code ? code.substring(0, 10) + "..." : "none");
    console.log("🔐 [Token Exchange] Client ID:", client_id);

    // Validate grant type
    if (grant_type !== "authorization_code") {
      const errorResponse = NextResponse.json(
        { error: "unsupported_grant_type", error_description: "Only authorization_code grant is supported" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse);
    }

    // Validate client
    if (client_id !== AI_AGENT_CLIENT_ID) {
      const errorResponse = NextResponse.json(
        { error: "invalid_client", error_description: "Invalid client ID" },
        { status: 401 }
      );
      return addCorsHeaders(errorResponse);
    }

    // Validate redirect URI
    if (redirect_uri !== AI_AGENT_REDIRECT_URI) {
      const errorResponse = NextResponse.json(
        { error: "invalid_grant", error_description: "Invalid redirect URI" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse);
    }

    if (!code) {
      const errorResponse = NextResponse.json(
        { error: "invalid_request", error_description: "Authorization code is required" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse);
    }

    // Find authorization code
    // Note: Prisma converts model names to camelCase, so OAuthAuthorization becomes oAuthAuthorization
    const authorization = await db.oAuthAuthorization.findUnique({
      where: { authorizationCode: code },
      include: { user: true },
    });

    if (!authorization) {
      console.log("❌ [Token Exchange] Authorization code not found");
      const errorResponse = NextResponse.json(
        { error: "invalid_grant", error_description: "Invalid authorization code" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse);
    }

    console.log("✅ [Token Exchange] Authorization code found");

    // Check if code is expired
    if (authorization.expiresAt < new Date()) {
      console.log("❌ [Token Exchange] Authorization code expired");
      const errorResponse = NextResponse.json(
        { error: "invalid_grant", error_description: "Authorization code expired" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse);
    }

    // Check if code was already used
    if (authorization.used) {
      console.log("❌ [Token Exchange] Authorization code already used");
      const errorResponse = NextResponse.json(
        { error: "invalid_grant", error_description: "Authorization code already used" },
        { status: 400 }
      );
      return addCorsHeaders(errorResponse);
    }

    // Validate PKCE if provided
    if (authorization.codeChallenge) {
      if (!code_verifier) {
        const errorResponse = NextResponse.json(
          { error: "invalid_request", error_description: "Code verifier is required" },
          { status: 400 }
        );
        return addCorsHeaders(errorResponse);
      }

      let expectedChallenge: string;
      if (authorization.codeChallengeMethod === "S256") {
        expectedChallenge = crypto
          .createHash("sha256")
          .update(code_verifier)
          .digest("base64url");
      } else {
        expectedChallenge = code_verifier;
      }

      if (expectedChallenge !== authorization.codeChallenge) {
        const errorResponse = NextResponse.json(
          { error: "invalid_grant", error_description: "Invalid code verifier" },
          { status: 400 }
        );
        return addCorsHeaders(errorResponse);
      }
    }

    // Parse scopes
    const scopes = JSON.parse(authorization.scopes || "[]");

    // Mark authorization code as used
    await db.oAuthAuthorization.update({
      where: { id: authorization.id },
      data: { used: true },
    });

    // Generate access token with scopes
    const accessToken = jwt.sign(
      {
        userId: authorization.userId,
        email: authorization.user.email,
        clientId: AI_AGENT_CLIENT_ID,
        scopes: scopes,
        type: "oauth_access_token",
      },
      JWT_SECRET,
      { expiresIn: "24h" } // Access token valid for 24 hours
    );

    // Generate refresh token (optional, for token refresh)
    const refreshToken = jwt.sign(
      {
        userId: authorization.userId,
        clientId: AI_AGENT_CLIENT_ID,
        type: "oauth_refresh_token",
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    console.log("✅ [Token Exchange] Token generated successfully");
    console.log("🔐 [Token Exchange] Scopes:", scopes);
    
    // Add CORS headers to allow cross-origin requests from localhost:3000
    const response = NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 86400, // 24 hours (in seconds)
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    });
    
    return addCorsHeaders(response);
  } catch (error: any) {
    console.error("❌ [Token Exchange] Token exchange error:", error);
    console.error("❌ [Token Exchange] Error message:", error.message);
    console.error("❌ [Token Exchange] Error stack:", error.stack);
    
    const errorResponse = NextResponse.json(
      {
        error: "server_error",
        error_description: error.message || "Internal server error",
      },
      { status: 500 }
    );
    
    return addCorsHeaders(errorResponse);
  }
}

