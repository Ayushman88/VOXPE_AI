import { NextRequest, NextResponse } from "next/server";
import { bankingAPI } from "@/lib/banking-api";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    bankingAPI.setAuthToken(token);

    const accounts = await bankingAPI.getAccounts();
    return NextResponse.json(accounts);
  } catch (error: any) {
    console.error("Error in AI accounts proxy:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
