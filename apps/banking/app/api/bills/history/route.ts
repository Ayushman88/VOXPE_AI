import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const billType = searchParams.get("billType");

    const billPayments = await db.billPayment.findMany({
      where: {
        userId: auth.userId,
        ...(billType ? { billType: billType as any } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(billPayments);
  } catch (error: any) {
    console.error("Error fetching bill history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
