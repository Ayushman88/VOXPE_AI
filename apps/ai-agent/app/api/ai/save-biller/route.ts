import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-ai";
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

    const { billType, billerName, consumerNumber, nickname } = await request.json();

    if (!billType || !billerName || !consumerNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const savedBiller = await db.savedBiller.upsert({
      where: {
        bankingUserId_consumerNumber_billerName: {
          bankingUserId: userId,
          consumerNumber,
          billerName,
        },
      },
      update: {
        billType,
        nickname,
        updatedAt: new Date(),
      },
      create: {
        bankingUserId: userId,
        billType,
        billerName,
        consumerNumber,
        nickname,
      },
    });

    return NextResponse.json({ success: true, savedBiller });
  } catch (error: any) {
    console.error("Error saving biller:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const savedBillers = await db.savedBiller.findMany({
      where: { bankingUserId: userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(savedBillers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
