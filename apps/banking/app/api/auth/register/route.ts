import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate phone (should be 10 digits for Indian numbers)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "Phone number must be 10 digits" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email or phone number" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and account in a transaction
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        hashedPassword,
        accounts: {
          create: {
            type: "SAVINGS",
            accountNumber: `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ifsc: "DUMMY0001234",
            balance: 10000, // Starting balance for demo
            status: "ACTIVE",
          },
        },
      },
      include: {
        accounts: true,
      },
    });

    const account = user.accounts[0];

    return NextResponse.json({
      message: "User registered successfully",
      user: { id: user.id, email: user.email, name: user.name },
      account: { accountNumber: account.accountNumber },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Registration error:", error);
    
    // Handle Prisma errors
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "User already exists with this email or phone number" },
        { status: 409 }
      );
    }

    // Handle database connection errors
    if (error.message?.includes("connect") || error.message?.includes("database")) {
      return NextResponse.json(
        { error: "Database connection error. Please check your database configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

