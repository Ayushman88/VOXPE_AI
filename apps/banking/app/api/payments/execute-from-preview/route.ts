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
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { previewId, consentToken, bankReferenceId, status } = await request.json();

    if (!previewId || !consentToken) {
      return NextResponse.json(
        { error: "Preview ID and consent token are required" },
        { status: 400 }
      );
    }

    // Verify preview and consent token
    const preview = await db.paymentPreview.findFirst({
      where: {
        id: previewId,
        userId,
        consentToken,
        status: "CONFIRMED",
      },
      include: {
        fromAccount: true,
        beneficiary: true,
      },
    });

    if (!preview) {
      return NextResponse.json(
        { error: "Invalid preview or consent token" },
        { status: 400 }
      );
    }

    if (preview.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Preview has expired" },
        { status: 400 }
      );
    }

    const account = preview.fromAccount;
    const accountBalance = parseFloat(account.balance.toString());
    const finalDebitAmount = parseFloat(preview.finalDebitAmount.toString());

    if (accountBalance < finalDebitAmount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Update account balance
    await db.account.update({
      where: { id: account.id },
      data: {
        balance: accountBalance - finalDebitAmount,
      },
    });

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        userId,
        fromAccountId: account.id,
        beneficiaryId: preview.beneficiaryId,
        paymentPreviewId: preview.id,
        method: preview.method,
        amount: preview.requestedAmount,
        status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
        bankReferenceId: bankReferenceId || `BNK${Date.now()}${Math.floor(Math.random() * 10000)}`,
        initiatedBy: "VOICE_AI",
        channel: "VOICE_AGENT",
      },
    });

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      bankReferenceId: transaction.bankReferenceId,
    });
  } catch (error) {
    console.error("Error executing payment from preview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

