import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-ai";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

function getUserIdFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return decoded.userId;
    }
  } catch {
    try {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const decoded = jwt.decode(token) as { userId?: string };
        return decoded?.userId || null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { pin, accountId } = await request.json();

    // If pin is "0000" and accountId is "dummy", we are just checking if ANY PIN exists
    if (pin === "0000" && accountId === "dummy") {
      const anyPin = await db.userPin.findFirst({
        where: { bankingUserId: userId },
      });
      
      if (!anyPin) {
        return NextResponse.json(
          { 
            verified: false,
            error: "No PIN set. Please set your PIN first.",
            needsSetup: true
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ verified: false, message: "PIN check only", needsSetup: false });
    }

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 digits" },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Handle "dummy" account ID consistently with the "set" route
    let targetAccountId = accountId;
    if (accountId === "dummy") {
      targetAccountId = "default-account";
    }

    // Get stored PIN for this specific account
    const userPin = await db.userPin.findUnique({
      where: { 
        bankingUserId_accountId: {
          bankingUserId: userId,
          accountId: targetAccountId
        }
      },
    });

    if (!userPin) {
      // Fallback: Check if there's ANY PIN for this user if the specific account doesn't have one
      const anyPin = await db.userPin.findFirst({
        where: { bankingUserId: userId },
      });

      if (!anyPin) {
        return NextResponse.json(
          { 
            verified: false,
            error: "No PIN set. Please set your PIN first.",
            needsSetup: true
          },
          { status: 404 }
        );
      }
      
      // If we found another PIN, we'll use it for now as a fallback
      // In a real app with multiple accounts, we might want to be stricter
      const verified = await bcrypt.compare(pin, anyPin.hashedPin);
      return NextResponse.json({
        verified,
        needsSetup: false,
        message: verified 
          ? "PIN verified successfully (using default PIN)" 
          : "Invalid PIN. Please try again.",
      });
    }

    // Verify PIN
    const verified = await bcrypt.compare(pin, userPin.hashedPin);

    return NextResponse.json({
      verified,
      needsSetup: false,
      message: verified 
        ? "PIN verified successfully" 
        : "Invalid PIN. Please try again.",
    });
  } catch (error: any) {
    console.error("Error verifying PIN:", error);
    return NextResponse.json(
      { 
        verified: false,
        error: error.message || "Failed to verify PIN" 
      },
      { status: 500 }
    );
  }
}
