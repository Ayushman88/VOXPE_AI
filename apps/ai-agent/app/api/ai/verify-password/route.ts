import { NextRequest, NextResponse } from "next/server";
import { bankingAPI } from "@/lib/banking-api";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.decode(token) as { email?: string };
    
    if (!decoded?.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    try {
      // Try to login with the email from the token and the provided password
      await bankingAPI.login(decoded.email, password);
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ success: false, error: "Invalid password" });
    }
  } catch (error: any) {
    console.error("Error verifying password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
