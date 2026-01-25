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

// Helper function to calculate cosine similarity between two vectors
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { embedding } = await request.json();

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json({ error: "Invalid embedding data" }, { status: 400 });
    }

    // Get the stored voice profile
    const profile = await db.voiceProfile.findUnique({
      where: { bankingUserId: userId },
    });

    if (!profile) {
      return NextResponse.json({ 
        verified: false, 
        error: "Voice profile not found. Please enroll your voice first.",
        needsEnrollment: true
      }, { status: 404 });
    }

    const storedEmbedding = profile.embedding as number[];
    const similarity = calculateCosineSimilarity(embedding, storedEmbedding);
    
    // Threshold for voice matching (0.85 as suggested)
    const threshold = 0.85;
    const verified = similarity >= threshold;

    console.log(`🎤 Voice Verification: Similarity Score = ${similarity.toFixed(4)} (Threshold = ${threshold})`);

    return NextResponse.json({
      verified,
      score: similarity,
      message: verified ? "Voice signature matched" : "Voice signature did not match",
    });
  } catch (error: any) {
    console.error("Error in voice verification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify voice" },
      { status: 500 }
    );
  }
}
