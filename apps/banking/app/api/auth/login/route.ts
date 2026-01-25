import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-banking";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set in environment variables. Using default (not secure for production).");
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log("Login attempt for email:", email);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log("Login failed: User not found for email:", email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.hashedPassword);

    if (!isValidPassword) {
      console.log("Login failed: Invalid password for email:", email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    console.log("Login successful for user:", user.email);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Create JSON response with token
    const response = NextResponse.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name },
      success: true
    });

    // Set token as HTTP-only cookie for better security
    // Use "none" for sameSite in development to work with popups
    // In production, you might want to use "lax" or "strict" depending on your needs
    const sameSite = process.env.NODE_ENV === "production" ? "lax" : "lax";
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: sameSite,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      // Don't set domain - let browser use default (current domain)
    });
    
    console.log("🔐 [Login API] Cookie set with sameSite:", sameSite);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Login error:", message, stack || "");

    // In development, surface the real error to help debug (e.g. DB connection, missing tables)
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: isDev ? message : "Internal server error",
        ...(isDev && { details: stack }),
      },
      { status: 500 }
    );
  }
}

