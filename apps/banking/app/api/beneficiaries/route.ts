import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import { decodeOAuthToken, hasScope } from "@/lib/oauth";

function getUserIdFromToken(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = decodeOAuthToken(token);
    
    // Support both OAuth tokens and regular JWT tokens
    if (payload?.type === "oauth_access_token") {
      // Check scope for OAuth tokens
      if (!hasScope(token, "read_beneficiaries")) {
        return null; // Missing required scope
      }
    }
    
    return payload?.userId || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const beneficiaries = await db.beneficiary.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        upiId: true,
        beneficiaryAccountNumber: true,
        beneficiaryIfsc: true,
        isActive: true,
      },
    });

    return NextResponse.json(beneficiaries);
  } catch (error) {
    console.error("Error fetching beneficiaries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    const { name, upiId, beneficiaryAccountNumber, beneficiaryIfsc } = await request.json();

    if (!name || (!upiId && (!beneficiaryAccountNumber || !beneficiaryIfsc))) {
      return NextResponse.json(
        { error: "Name and either UPI ID or account details are required" },
        { status: 400 }
      );
    }

    const beneficiary = await db.beneficiary.create({
      data: {
        userId,
        name,
        upiId: upiId || null,
        beneficiaryAccountNumber: beneficiaryAccountNumber || null,
        beneficiaryIfsc: beneficiaryIfsc || null,
      },
    });

    return NextResponse.json(beneficiary);
  } catch (error) {
    console.error("Error creating beneficiary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

