import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-ai";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const ENROLLMENT_EXPIRY_DAYS = 90;

function getUserIdFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return decoded.userId;
    }
  } catch {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token) as { userId?: string };
      return decoded?.userId || null;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { embedding, pin } = await request.json();

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json({ error: "Invalid embedding data" }, { status: 400 });
    }

    // Check if a profile already exists
    const existingProfile = await db.voiceProfile.findUnique({
      where: { bankingUserId: userId },
    });

    if (existingProfile) {
      // Re-enrollment requires PIN verification
      if (!pin) {
        return NextResponse.json({ 
          error: "PIN verification required for voice re-enrollment",
          needsPin: true 
        }, { status: 403 });
      }

      const userPin = await db.userPin.findFirst({
        where: { bankingUserId: userId },
      });

      if (!userPin) {
        return NextResponse.json({ 
          error: "Security PIN not set. Please set up a PIN first." 
        }, { status: 400 });
      }

      const pinMatched = await bcrypt.compare(pin, userPin.hashedPin);
      if (!pinMatched) {
        return NextResponse.json({ error: "Invalid security PIN" }, { status: 401 });
      }
    }

    // Store or update the voice profile
    await db.voiceProfile.upsert({
      where: { bankingUserId: userId },
      update: {
        embedding: embedding,
        updatedAt: new Date(),
      },
      create: {
        bankingUserId: userId,
        embedding: embedding,
      },
    });

    return NextResponse.json({ success: true, message: "Voice profile enrolled successfully" });
  } catch (error: any) {
    console.error("Error in voice enrollment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enroll voice" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.voiceProfile.findUnique({
      where: { bankingUserId: userId },
      select: { createdAt: true, updatedAt: true },
    });

    if (!profile) {
      return NextResponse.json({ exists: false });
    }

    const lastUpdated = new Date(profile.updatedAt);
    const expiryDate = new Date(lastUpdated);
    expiryDate.setDate(expiryDate.getDate() + ENROLLMENT_EXPIRY_DAYS);
    
    const isExpired = new Date() > expiryDate;
    const daysUntilExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({ 
      exists: true, 
      isExpired,
      daysUntilExpiry,
      lastUpdated: profile.updatedAt,
      expiresAt: expiryDate,
      profile 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
