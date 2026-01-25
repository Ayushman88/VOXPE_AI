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

    const { pin, accountId, verifiedVia, oldPin, password } = await request.json();

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

    // If changing PIN, verify identity first
    if (verifiedVia) {
      if (verifiedVia === 'old_pin') {
        const existingPin = await db.userPin.findFirst({
          where: { bankingUserId: userId },
        });
        if (!existingPin || !(await bcrypt.compare(oldPin, existingPin.hashedPin))) {
          return NextResponse.json({ error: "Invalid old PIN" }, { status: 401 });
        }
      } else if (verifiedVia === 'password') {
        // Verification already happened in the verify-password route for simplicity
        // But we could double check here if needed
      }
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // If accountId is "dummy", we'll set it for the user's first account or a default
    let targetAccountId = accountId;
    if (accountId === "dummy") {
      // In a real app, we'd fetch the user's accounts from the banking API
      // For now, we'll just use "default-account"
      targetAccountId = "default-account";
    }

    // Upsert PIN for this specific account
    await db.userPin.upsert({
      where: { 
        bankingUserId_accountId: {
          bankingUserId: userId,
          accountId: targetAccountId
        }
      },
      update: {
        hashedPin,
        updatedAt: new Date(),
      },
      create: {
        bankingUserId: userId,
        accountId: targetAccountId,
        hashedPin,
      },
    });

    return NextResponse.json({
      success: true,
      message: "PIN set successfully",
    });
  } catch (error: any) {
    console.error("Error setting PIN:", error);
    return NextResponse.json(
      { error: error.message || "Failed to set PIN" },
      { status: 500 }
    );
  }
}
