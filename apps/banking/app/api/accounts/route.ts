import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import { decodeOAuthToken, hasScope } from "@/lib/oauth";

function getUserIdFromToken(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = decodeOAuthToken(token);
    
    // Support both OAuth tokens and regular JWT tokens
    if (payload?.type === "oauth_access_token") {
      // Check scope for OAuth tokens
      if (!hasScope(token, "read_balance")) {
        return null; // Missing required scope
      }
    }
    
    return payload?.userId || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accounts = await db.account.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        type: true,
        accountNumber: true,
        ifsc: true,
        balance: true,
        status: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

