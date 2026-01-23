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

// Rules engine
function checkPaymentRules(
  accountBalance: number,
  requestedAmount: number,
  method: string
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const DAILY_LIMIT = 100000;
  const PER_TXN_LIMIT = 50000;

  if (accountBalance < requestedAmount) {
    reasons.push("Insufficient balance");
    return { allowed: false, reasons };
  }

  if (requestedAmount > PER_TXN_LIMIT) {
    reasons.push(`Amount exceeds per-transaction limit of ₹${PER_TXN_LIMIT}`);
    return { allowed: false, reasons };
  }

  // In a real system, we'd check daily limits here
  // For now, we'll allow it

  return { allowed: true, reasons: [] };
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

    const { fromAccountId, beneficiaryId, amount, method } = await request.json();

    if (!fromAccountId || !beneficiaryId || !amount || !method) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const account = await db.account.findFirst({
      where: {
        id: fromAccountId,
        userId,
        status: "ACTIVE",
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const beneficiary = await db.beneficiary.findFirst({
      where: {
        id: beneficiaryId,
        userId,
        isActive: true,
      },
    });

    if (!beneficiary) {
      return NextResponse.json(
        { error: "Beneficiary not found" },
        { status: 404 }
      );
    }

    const requestedAmount = parseFloat(amount);
    const accountBalance = parseFloat(account.balance.toString());

    // Calculate charges (simplified)
    let charges = 0;
    if (method === "NEFT") {
      charges = requestedAmount > 10000 ? 2.5 : 0;
    } else if (method === "IMPS") {
      charges = requestedAmount > 10000 ? 5 : 0;
    }
    // UPI is free

    const finalDebitAmount = requestedAmount + charges;

    const rulesResult = checkPaymentRules(accountBalance, finalDebitAmount, method);

    const preview = await db.paymentPreview.create({
      data: {
        userId,
        fromAccountId,
        beneficiaryId,
        method,
        requestedAmount,
        charges,
        finalDebitAmount,
        rulesResult: JSON.stringify(rulesResult),
        status: "PENDING",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    return NextResponse.json({
      previewId: preview.id,
      requestedAmount,
      charges,
      finalDebitAmount,
      rulesResult,
      expiresAt: preview.expiresAt,
    });
  } catch (error) {
    console.error("Error creating payment preview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

