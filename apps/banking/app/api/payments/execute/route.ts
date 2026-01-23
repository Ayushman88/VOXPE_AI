import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

function getUserIdFromToken(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
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

    const { fromAccountId, beneficiaryId, amount, method } = await request.json();

    // For direct execution (from UI), we create a preview first, then execute
    const previewRes = await fetch(`${request.nextUrl.origin}/api/payments/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: request.headers.get("authorization") || "",
      },
      body: JSON.stringify({ fromAccountId, beneficiaryId, amount, method }),
    });

    const previewData = await previewRes.json();

    if (!previewRes.ok || !previewData.rulesResult.allowed) {
      return NextResponse.json(
        { error: previewData.rulesResult?.reasons?.[0] || "Payment not allowed" },
        { status: 400 }
      );
    }

    // Execute the payment
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

    const finalDebitAmount = parseFloat(previewData.finalDebitAmount);
    const accountBalance = parseFloat(account.balance.toString());

    if (accountBalance < finalDebitAmount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Update account balance
    await db.account.update({
      where: { id: fromAccountId },
      data: {
        balance: accountBalance - finalDebitAmount,
      },
    });

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        userId,
        fromAccountId,
        beneficiaryId,
        method,
        amount: previewData.requestedAmount,
        status: "SUCCESS",
        bankReferenceId: `BNK${Date.now()}${Math.floor(Math.random() * 10000)}`,
        initiatedBy: "USER_UI",
        channel: "WEB",
      },
    });

    // Update preview status
    await db.paymentPreview.update({
      where: { id: previewData.previewId },
      data: { status: "CONFIRMED" },
    });

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      bankReferenceId: transaction.bankReferenceId,
      amount: transaction.amount,
    });
  } catch (error) {
    console.error("Error executing payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

