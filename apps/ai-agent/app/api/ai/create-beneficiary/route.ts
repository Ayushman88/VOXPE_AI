import { NextRequest, NextResponse } from "next/server";
import { browserAutomation } from "@/lib/browser-automation";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { name, upiId, beneficiaryAccountNumber, beneficiaryIfsc } = await request.json();

    if (!name || (!upiId && (!beneficiaryAccountNumber || !beneficiaryIfsc))) {
      return NextResponse.json(
        { error: "Name and either UPI ID or account details are required" },
        { status: 400 }
      );
    }

    const traceId = uuidv4();
    console.log(`🌐 [Create Beneficiary API] Calling browser automation for: ${name}`);
    console.log(`🌐 [Create Beneficiary API] Worker URL: ${process.env.BROWSER_AUTOMATION_URL || "http://localhost:3001"}`);
    
    const result = await browserAutomation.createBeneficiary({
      name,
      upiId: upiId || null,
      accountNumber: beneficiaryAccountNumber || null,
      ifsc: beneficiaryIfsc || null,
      traceId,
    });
    
    console.log(`🌐 [Create Beneficiary API] Browser automation result:`, result);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to create beneficiary via browser automation",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      name: result.beneficiaryName,
      success: true,
      message: "Beneficiary created successfully via browser automation",
    });
  } catch (error: any) {
    console.error("Error creating beneficiary:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
