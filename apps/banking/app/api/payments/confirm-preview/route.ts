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
      if (!hasScope(token, "payments")) {
        return null; // Missing required scope
      }
    }
    
    return payload?.userId || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔐 [Confirm Preview] ========== CONFIRM PREVIEW REQUEST ==========");
    const userId = getUserIdFromToken(request);
    console.log("🔐 [Confirm Preview] User ID:", userId);

    if (!userId) {
      console.log("❌ [Confirm Preview] Unauthorized - no userId");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { previewId, consentToken } = await request.json();
    console.log("🔐 [Confirm Preview] Preview ID:", previewId);
    console.log("🔐 [Confirm Preview] Consent token:", consentToken ? consentToken.substring(0, 20) + "..." : "missing");

    if (!previewId || !consentToken) {
      console.log("❌ [Confirm Preview] Missing previewId or consentToken");
      return NextResponse.json(
        { error: "Preview ID and consent token are required" },
        { status: 400 }
      );
    }

    // Update preview with consent token and confirm status
    const preview = await db.paymentPreview.findFirst({
      where: {
        id: previewId,
        userId,
        status: "PENDING",
      },
    });

    console.log("🔐 [Confirm Preview] Preview found:", !!preview);
    if (preview) {
      console.log("🔐 [Confirm Preview] Preview status:", preview.status);
      console.log("🔐 [Confirm Preview] Preview userId:", preview.userId);
      console.log("🔐 [Confirm Preview] Preview expiresAt:", preview.expiresAt);
    }

    if (!preview) {
      console.log("❌ [Confirm Preview] Preview not found or already confirmed");
      return NextResponse.json(
        { error: "Preview not found or already confirmed" },
        { status: 404 }
      );
    }

    if (preview.expiresAt < new Date()) {
      console.log("❌ [Confirm Preview] Preview expired");
      return NextResponse.json(
        { error: "Preview has expired" },
        { status: 400 }
      );
    }

    // Update preview with consent token and confirm status
    console.log("✅ [Confirm Preview] Updating preview with consent token and CONFIRMED status");
    await db.paymentPreview.update({
      where: { id: previewId },
      data: {
        consentToken,
        status: "CONFIRMED",
      },
    });

    console.log("✅ [Confirm Preview] Preview confirmed successfully");
    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("❌ [Confirm Preview] Error confirming payment preview:", error);
    console.error("❌ [Confirm Preview] Error stack:", error.stack);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

