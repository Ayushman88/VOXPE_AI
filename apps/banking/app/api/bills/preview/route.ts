import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fromAccountId, billType, billerName, consumerNumber, amount } = await request.json();

    if (!fromAccountId || !billType || !billerName || !consumerNumber || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const account = await db.account.findUnique({
      where: { id: fromAccountId, userId: auth.userId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const numAmount = parseFloat(amount);
    if (numAmount > parseFloat(account.balance.toString())) {
      return NextResponse.json({
        error: "Insufficient balance",
        rulesResult: { allowed: false, reasons: ["Insufficient balance"] },
      }, { status: 400 });
    }

    // Create bill preview
    const consentToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const preview = await db.billPreview.create({
      data: {
        userId: auth.userId,
        fromAccountId: account.id,
        billType,
        billerName,
        consumerNumber,
        amount: numAmount,
        charges: 0,
        finalDebitAmount: numAmount,
        status: "PENDING",
        consentToken,
        expiresAt,
      },
    });

    return NextResponse.json({
      previewId: preview.id,
      billType,
      billerName,
      consumerNumber,
      amount: numAmount,
      finalDebitAmount: numAmount,
      consentToken,
      expiresAt,
      rulesResult: { allowed: true, reasons: [] },
    });
  } catch (error: any) {
    console.error("Error in bill preview:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
