import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { previewId, consentToken } = await request.json();

    if (!previewId || !consentToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const preview = await db.billPreview.findUnique({
      where: { id: previewId, userId: auth.userId },
      include: { fromAccount: true },
    });

    if (!preview) {
      return NextResponse.json({ error: "Bill preview not found" }, { status: 404 });
    }

    if (preview.consentToken !== consentToken) {
      return NextResponse.json({ error: "Invalid consent token" }, { status: 403 });
    }

    if (new Date() > preview.expiresAt) {
      return NextResponse.json({ error: "Preview expired" }, { status: 400 });
    }

    if (preview.status !== "PENDING") {
      return NextResponse.json({ error: "Bill already processed or cancelled" }, { status: 400 });
    }

    // Check if already executed (idempotency)
    const existingPayment = await db.billPayment.findFirst({
      where: { billPreviewId: previewId },
    });
    if (existingPayment) {
      return NextResponse.json({
        success: true,
        transactionId: existingPayment.id,
        bankReferenceId: existingPayment.bankReferenceId,
      });
    }

    const finalDebitAmount = parseFloat(preview.finalDebitAmount.toString());

    const result = await db.$transaction(async (tx) => {
      // 1. Update account balance
      const updatedAccount = await tx.account.update({
        where: { id: preview.fromAccountId },
        data: { balance: { decrement: finalDebitAmount } },
      });

      if (parseFloat(updatedAccount.balance.toString()) < 0) {
        throw new Error("Insufficient balance after transaction");
      }

      // 2. Create bill payment record
      const bankReferenceId = "BILL-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      const payment = await tx.billPayment.create({
        data: {
          userId: auth.userId,
          fromAccountId: preview.fromAccountId,
          billPreviewId: preview.id,
          billType: preview.billType,
          billerName: preview.billerName,
          consumerNumber: preview.consumerNumber,
          amount: preview.amount,
          status: "SUCCESS",
          bankReferenceId,
          initiatedBy: "VOICE_AI",
        },
      });

      // 3. Update preview status
      await tx.billPreview.update({
        where: { id: preview.id },
        data: { status: "CONFIRMED" },
      });

      return { payment, bankReferenceId };
    });

    return NextResponse.json({
      success: true,
      transactionId: result.payment.id,
      bankReferenceId: result.bankReferenceId,
    });
  } catch (error: any) {
    console.error("Error in bill execution:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
