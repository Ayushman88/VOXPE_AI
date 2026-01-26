import { NextRequest, NextResponse } from "next/server";
import { db } from "@voxpe/db-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { bankingAPI } from "@/lib/banking-api";
import {
  checkRateLimit,
  detectFraudulentActivity,
  logAIAction,
  explainAIDecision,
} from "@/lib/security";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
function getUserIdFromRequest(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get("authorization");
    console.log("🔐 [Process Command] Auth header present:", !!authHeader);
    
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      console.log("🔐 [Process Command] Token length:", token.length);
      console.log("🔐 [Process Command] Token preview:", token.substring(0, 50) + "...");
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        console.log("✅ [Process Command] Token verified successfully, userId:", decoded.userId);
        return decoded.userId;
      } catch (verifyError: any) {
        console.error("❌ [Process Command] Token verification failed:", verifyError.message);
        console.error("❌ [Process Command] JWT_SECRET configured:", !!JWT_SECRET);
      }
    } else {
      console.log("⚠️ [Process Command] No Bearer token in Authorization header");
    }
  } catch (error: any) {
    console.error("❌ [Process Command] Error parsing auth header:", error.message);
  }
  return null;
}

interface ParsedIntent {
  intent: "MAKE_PAYMENT" | "CHECK_BALANCE" | "SHOW_TRANSACTIONS" | "PAY_BILL" | "UNKNOWN";
  amount?: number;
  currency?: string;
  payee_name?: string;
  payment_method?: "UPI" | "IMPS" | "NEFT";
  bill_type?: string;
  consumer_number?: string;
  biller_name?: string;
  schedule?: "NOW" | string;
}

async function parseIntent(command: string): Promise<ParsedIntent> {
  const systemPrompt = `You are a banking AI assistant. Parse the user's command and return ONLY valid JSON with this EXACT structure:
{
  "intent": "MAKE_PAYMENT" | "CHECK_BALANCE" | "SHOW_TRANSACTIONS" | "PAY_BILL" | "UNKNOWN",
  "amount": number (if payment/bill, REQUIRED),
  "currency": "INR" (default, always include),
  "payee_name": string (if MAKE_PAYMENT, REQUIRED),
  "bill_type": "ELECTRICITY" | "WATER" | "GAS" | "BROADBAND" | "MOBILE_POSTPAID" | "MOBILE_RECHARGE" | "DTH" (if PAY_BILL, REQUIRED),
  "consumer_number": string (if PAY_BILL, REQUIRED),
  "biller_name": string (if PAY_BILL, REQUIRED),
  "payment_method": "UPI" | "IMPS" | "NEFT" (if MAKE_PAYMENT, default "UPI"),
  "schedule": "NOW" (default, always include)
}

CRITICAL PARSING RULES:
1. If command contains "pay bill", "electricity", "water", "gas", "recharge" → intent MUST be "PAY_BILL"
2. If command contains "pay", "send", "transfer", "give", "money" AND NOT "bill" → intent MUST be "MAKE_PAYMENT"
3. If command contains "balance", "how much", "account" → intent MUST be "CHECK_BALANCE"
4. If command contains "transaction", "history", "payment", "statement" → intent MUST be "SHOW_TRANSACTIONS"
5. Extract amount: Look for numbers like "300", "Rs 300", "₹300", "300 rupees"
6. For PAY_BILL:
   - Identify bill_type (ELECTRICITY, WATER, GAS, BROADBAND, MOBILE_POSTPAID, MOBILE_RECHARGE, DTH)
   - Identify consumer_number (usually a string of digits or alphanum)
   - Identify biller_name (e.g., "Tata Power", "BSNL", "Airtel")
7. For MAKE_PAYMENT:
   - Identify payee_name (name after "to")

EXAMPLES:
- "Pay electricity bill of Rs 1200 for consumer 987654321 at Tata Power" → {"intent":"PAY_BILL","amount":1200,"currency":"INR","bill_type":"ELECTRICITY","consumer_number":"987654321","biller_name":"Tata Power","schedule":"NOW"}
- "Recharge my Airtel mobile with 499, number 9888888888" → {"intent":"PAY_BILL","amount":499,"currency":"INR","bill_type":"MOBILE_RECHARGE","consumer_number":"9888888888","biller_name":"Airtel","schedule":"NOW"}
- "Pay 500 rupees to Rohan via UPI" → {"intent":"MAKE_PAYMENT","amount":500,"currency":"INR","payee_name":"Rohan","payment_method":"UPI","schedule":"NOW"}

IMPORTANT: Always return valid JSON. If you cannot determine intent, return {"intent":"UNKNOWN","currency":"INR","schedule":"NOW"}`;

  try {
    console.log("🤖 Calling Gemini to parse command:", command);
    
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      console.warn("⚠️ GEMINI_API_KEY not set, using fallback parser");
      return parseIntentFallback(command);
    }

    const fullPrompt = `${systemPrompt}\n\nUser command: "${command}"\n\nReturn ONLY the JSON object, no other text.`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const content = response.text();
    
    console.log("🤖 Gemini response:", content);
    
    if (!content) {
      console.error("Gemini returned empty content");
      return parseIntentFallback(command);
    }

    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/```\n?/g, "").trim();
    }

    const parsed = JSON.parse(jsonContent);
    console.log("✅ Parsed intent result:", parsed);
    
    if (!parsed.intent || parsed.intent === "UNKNOWN") {
      console.warn("⚠️ Gemini returned UNKNOWN or missing intent, using fallback parser");
      return parseIntentFallback(command);
    }
    
    if (parsed.intent === "MAKE_PAYMENT" && (!parsed.amount || !parsed.payee_name)) {
      console.warn("⚠️ Gemini parsed as payment but missing amount or payee, using fallback");
      return parseIntentFallback(command);
    }
    
    return parsed as ParsedIntent;
  } catch (error: any) {
    console.error("❌ Error parsing intent with Gemini:", error);
    console.error("Error details:", error.message, error.stack);
    
    if (error.message?.includes("quota") || error.message?.includes("billing") || 
        error.message?.includes("429") || error.status === 429) {
      console.warn("⚠️ Gemini quota exceeded or billing issue. Using fallback parser.");
    }
    
    return parseIntentFallback(command);
  }
}

function parseIntentFallback(command: string): ParsedIntent {
  console.log("🔄 Using fallback parser (OpenAI unavailable) for command:", command);
  const lowerCommand = command.toLowerCase().trim();
  
  // BILL PAYMENT / RECHARGE FALLBACK
  if (lowerCommand.includes("bill") || lowerCommand.includes("recharge") || 
      lowerCommand.includes("electricity") || lowerCommand.includes("water") || 
      lowerCommand.includes("gas") || lowerCommand.includes("dth") || 
      lowerCommand.includes("broadband") || lowerCommand.includes("mobile")) {
    
    console.log("Fallback: Bill payment/recharge intent");
    
    // Extract amount - improved regex
    const amountMatch = command.match(/(?:rs\.?|rupees?|₹|rupee)\s*(\d+(?:\.\d+)?)/i) || 
                        command.match(/\b(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|₹|rupee)\b/i) ||
                        command.match(/\bwith\s+(\d+(?:\.\d+)?)\b/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
    
    // Extract consumer number / phone number
    // Improved regex to handle various formats and avoid greedy matching of small numbers
    const consumerMatch = command.match(/\b(\d{10,12})\b/) || 
                          command.match(/\b(\d{5}\s\d{5})\b/) ||
                          command.match(/\b(\d{3}\s\d{3}\s\d{4})\b/);
    let consumerNumber = consumerMatch ? consumerMatch[1].replace(/[-\s]/g, "") : undefined;
    
    // Identify bill type
    let billType = "MOBILE_RECHARGE";
    if (lowerCommand.includes("electricity")) billType = "ELECTRICITY";
    else if (lowerCommand.includes("water")) billType = "WATER";
    else if (lowerCommand.includes("gas")) billType = "GAS";
    else if (lowerCommand.includes("broadband")) billType = "BROADBAND";
    else if (lowerCommand.includes("dth")) billType = "DTH";
    else if (lowerCommand.includes("postpaid")) billType = "MOBILE_POSTPAID";
    
    // Identify biller
    let billerName = undefined;
    const billerKeywords = {
      "Airtel": ["airtel"],
      "Jio": ["jio", "reliance jio"],
      "Vi": ["vi", "vodafone", "idea"],
      "BSNL": ["bsnl"],
      "Tata Power": ["tata power", "tata"],
      "Adani Power": ["adani power", "adani"],
    };

    for (const [name, keywords] of Object.entries(billerKeywords)) {
      if (keywords.some(k => lowerCommand.includes(k))) {
        billerName = name;
        break;
      }
    }

    if (!billerName && !lowerCommand.includes("recharge")) {
      billerName = "Default Biller"; 
    }

    return {
      intent: "PAY_BILL",
      amount,
      bill_type: billType,
      consumer_number: consumerNumber,
      biller_name: billerName,
      currency: "INR",
      schedule: "NOW",
    };
  }

  // MAKE PAYMENT FALLBACK
  if (lowerCommand.includes("pay") || lowerCommand.includes("send") || 
      lowerCommand.includes("transfer") || lowerCommand.includes("give") ||
      lowerCommand.includes("money")) {
    
    const amountMatch = command.match(/(?:rs\.?|rupees?|₹|rupee)?\s*(\d+(?:\.\d+)?)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
    console.log("Fallback: Extracted amount:", amount);
    
    let toMatch = command.match(/\bto\s+([A-Za-z]+)(?:\s+(?:via|by|through|using|with)\s+(?:upi|imps|neft|bank|account))/i);
    let payeeName = toMatch ? toMatch[1].trim() : undefined;
    
    if (!payeeName) {
      toMatch = command.match(/\bto\s+([A-Za-z]+)(?:\s+(?:via|by|through|using|with|for|and))/i);
      payeeName = toMatch ? toMatch[1].trim() : undefined;
    }
    
    if (!payeeName) {
      toMatch = command.match(/\bto\s+([A-Za-z]+)/i);
      payeeName = toMatch ? toMatch[1].trim() : undefined;
    }
    
    if (payeeName) {
      payeeName = payeeName.replace(/\s+(via|by|through|using|with|for|and|the|a|an)$/i, '').trim();
    }
    console.log("Fallback: Extracted payee:", payeeName);
    
    let paymentMethod: "UPI" | "IMPS" | "NEFT" = "UPI";
    if (lowerCommand.includes("imps")) paymentMethod = "IMPS";
    else if (lowerCommand.includes("neft")) paymentMethod = "NEFT";
    else if (lowerCommand.includes("upi")) paymentMethod = "UPI";
    
    const result = {
      intent: "MAKE_PAYMENT" as const,
      amount,
      currency: "INR" as const,
      payee_name: payeeName,
      payment_method: paymentMethod,
      schedule: "NOW" as const,
    };
    
    console.log("Fallback: Payment intent result:", result);
    return result;
  }
  
  if (lowerCommand.includes("balance") || lowerCommand.includes("how much") ||
      lowerCommand.includes("account balance")) {
    console.log("Fallback: Balance intent");
    return {
      intent: "CHECK_BALANCE",
      currency: "INR",
      schedule: "NOW",
    };
  }
  
  if (lowerCommand.includes("transaction") || lowerCommand.includes("history") || 
      (lowerCommand.includes("payment") && !lowerCommand.includes("pay")) ||
      lowerCommand.includes("statement")) {
    console.log("Fallback: Transactions intent");
    return {
      intent: "SHOW_TRANSACTIONS",
      currency: "INR",
      schedule: "NOW",
    };
  }
  
  console.log("Fallback: Unknown intent");
  return {
    intent: "UNKNOWN",
    currency: "INR",
    schedule: "NOW",
  };
}

// Helper to calculate cosine similarity
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
  const traceId = uuidv4();
  let userId: string | null = null;
  let effectiveUserId: string | null = null;

  try {
    const { command, voiceEmbedding } = await request.json();

    if (!command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    userId = getUserIdFromRequest(request);
    
    // ... rest of user identification logic ...
    if (!userId) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.decode(token) as { userId?: string };
          effectiveUserId = decoded?.userId || "demo-user-id";
        } catch {
          effectiveUserId = "demo-user-id";
        }
      } else {
        effectiveUserId = "demo-user-id";
      }
    } else {
      effectiveUserId = userId;
    }

    // CREATE AUDIT LOG ENTRY EARLY to prevent "traceId not found" issues
    await db.aiAuditLog.create({
      data: {
        userId: effectiveUserId!,
        rawCommandText: command,
        parsedIntentJson: JSON.stringify({ intent: "UNKNOWN" }),
        traceId,
      }
    });
    
    console.log("👤 [Process Command] Using effectiveUserId:", effectiveUserId);

    // VOICE BIOMETRIC VERIFICATION
    const voiceProfile = await db.voiceProfile.findUnique({
      where: { bankingUserId: effectiveUserId },
    });

    let isVoiceMatched = false;
    let voiceExpired = false;

    if (voiceProfile) {
      // Check for 90-day expiry
      const ENROLLMENT_EXPIRY_DAYS = 90;
      const lastUpdated = new Date(voiceProfile.updatedAt);
      const expiryDate = new Date(lastUpdated);
      expiryDate.setDate(expiryDate.getDate() + ENROLLMENT_EXPIRY_DAYS);
      
      if (new Date() > expiryDate) {
        console.log("⚠️ [Voice Biometrics] Profile expired");
        voiceExpired = true;
      } else if (!voiceEmbedding || !Array.isArray(voiceEmbedding)) {
        console.log("⚠️ [Voice Biometrics] Profile exists but no embedding provided in request");
      } else {
        const storedEmbedding = voiceProfile.embedding as number[];
        const similarity = calculateCosineSimilarity(voiceEmbedding, storedEmbedding);
        const threshold = 0.85;
        
        console.log(`🎤 [Voice Biometrics] Similarity: ${similarity.toFixed(4)} (Threshold: ${threshold})`);
        
        if (similarity < threshold) {
          console.log("❌ [Voice Biometrics] Verification failed!");
          await logAIAction(effectiveUserId, "VOICE_VERIFICATION_FAILED", command, {
            error: "Voice signature did not match",
            similarity,
            threshold
          }, {}, traceId);

          return NextResponse.json({
            response: "Sorry, I don't recognize your voice. For security reasons, I can only process commands from the authorized user.",
            voiceVerificationFailed: true,
            similarity
          });
        }
        console.log("✅ [Voice Biometrics] Verification successful");
        isVoiceMatched = true;
      }
    }

    const parsedIntent = await parseIntent(command);
    console.log("✅ Parsed intent:", JSON.stringify(parsedIntent, null, 2));
    
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      console.log("ℹ️ Note: Using fallback parser (Gemini/OpenAI API key not set)");
    }

    const isPaymentAction = parsedIntent.intent === "MAKE_PAYMENT";
    const rateLimitConfig = isPaymentAction 
      ? { maxRequests: 10, windowMs: 60000 }
      : { maxRequests: 30, windowMs: 60000 };
    
    const rateLimit = await checkRateLimit(
      effectiveUserId, 
      rateLimitConfig.maxRequests, 
      rateLimitConfig.windowMs
    );
    
    if (!rateLimit.allowed) {
      await logAIAction(effectiveUserId, "RATE_LIMIT_EXCEEDED", command, {
        error: "Rate limit exceeded",
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      }, {}, traceId);
      
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again after ${new Date(rateLimit.resetAt).toLocaleTimeString()}`,
          remaining: rateLimit.remaining,
        },
        { status: 429 }
      );
    }

    if (parsedIntent.intent === "MAKE_PAYMENT") {
      const fraudCheck = await detectFraudulentActivity(
        effectiveUserId,
        parsedIntent.intent,
        {
          amount: parsedIntent.amount,
          payee_name: parsedIntent.payee_name,
          method: parsedIntent.payment_method,
        }
      );

      if (fraudCheck.isFraudulent) {
        await logAIAction(effectiveUserId, parsedIntent.intent, command, {
          error: "Fraudulent activity detected",
          reasons: fraudCheck.reasons,
          blocked: true,
        }, { fraudDetected: true }, traceId);

        return NextResponse.json({
          response: `I cannot process this payment due to security concerns: ${fraudCheck.reasons.join(", ")}. Please contact support if you believe this is an error.`,
          preview: null,
          fraudDetected: true,
        });
      }
    }

    await logAIAction(
      effectiveUserId,
      parsedIntent.intent,
      command,
      { parsedIntent },
      { traceId },
      traceId
    );

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required. Please login first." },
        { status: 401 }
      );
    }
    bankingAPI.setAuthToken(authHeader.substring(7));

    if (parsedIntent.intent === "MAKE_PAYMENT") {
      if (!parsedIntent.amount || !parsedIntent.payee_name) {
        return NextResponse.json({
          response: "I need the amount and recipient name to process the payment.",
          preview: null,
        });
      }

      if (parsedIntent.amount <= 0 || parsedIntent.amount > 50000) {
        return NextResponse.json({
          response: "Payment amount must be between ₹1 and ₹50,000. For larger amounts, please use the banking app.",
          preview: null,
        });
      }

      let accounts;
      try {
        accounts = await bankingAPI.getAccounts();
      } catch (error: any) {
        console.error("Error fetching accounts:", error);
        return NextResponse.json({
          response: `Unable to access your accounts: ${error.message}. Please ensure you're registered at the banking app (http://localhost:3002/register).`,
          preview: null,
        });
      }
      
      if (!accounts || accounts.length === 0) {
        return NextResponse.json({
          response: "No active account found. Please register at the banking app first (http://localhost:3002/register).",
          preview: null,
        });
      }

      const account = accounts[0];

      let beneficiaries;
      try {
        beneficiaries = await bankingAPI.getBeneficiaries();
      } catch (error: any) {
        console.error("Error fetching beneficiaries:", error);
        return NextResponse.json({
          response: `Unable to access your beneficiaries: ${error.message}. Please add beneficiaries at the banking app (http://localhost:3002/beneficiaries).`,
          preview: null,
        });
      }
      
      const beneficiary = beneficiaries.find(
        (b) => b.name.toLowerCase().includes(parsedIntent.payee_name!.toLowerCase()) && b.isActive
      );

      if (!beneficiary) {
        return NextResponse.json({
          response: `I don't have "${parsedIntent.payee_name}" in your beneficiaries list. I can add them for you! Please provide their UPI ID (like name@upi) or their bank account number and IFSC code.`,
          preview: null,
          needsBeneficiaryDetails: true,
          beneficiaryName: parsedIntent.payee_name,
          amount: parsedIntent.amount,
          paymentMethod: parsedIntent.payment_method || "UPI",
        });
      }

      const previewData = await bankingAPI.createPaymentPreview({
        fromAccountId: account.id,
        beneficiaryId: beneficiary.id,
        amount: parsedIntent.amount,
        method: parsedIntent.payment_method || "UPI",
      });

      await db.aiAuditLog.updateMany({
        where: { traceId },
        data: { 
          previewId: previewData.previewId,
          parsedIntentJson: JSON.stringify(parsedIntent),
        },
      });

      const explanation = explainAIDecision(parsedIntent.intent, parsedIntent, previewData.rulesResult);

      return NextResponse.json({
        response: explanation + (voiceExpired ? "\n⚠️ Your voice signature has expired. Please re-enroll in Settings. " : "") + `You're about to pay ₹${previewData.requestedAmount} to ${beneficiary.name} via ${parsedIntent.payment_method || "UPI"}. ${previewData.charges > 0 ? `Charges: ₹${previewData.charges}. ` : ""}Total: ₹${previewData.finalDebitAmount}. Please confirm to proceed.`,
        voiceMatched: isVoiceMatched,
        voiceExpired,
        preview: {
          previewId: previewData.previewId,
          requestedAmount: previewData.requestedAmount,
          charges: previewData.charges,
          finalDebitAmount: previewData.finalDebitAmount,
          rulesResult: previewData.rulesResult,
          beneficiaryName: beneficiary.name,
          method: parsedIntent.payment_method || "UPI",
          accountNumber: account.accountNumber,
        },
        traceId,
      });

    } else if (parsedIntent.intent === "PAY_BILL") {
      // 1. Check for saved biller if name is missing but number is present
      if (!parsedIntent.biller_name && parsedIntent.consumer_number) {
        const saved = await db.savedBiller.findFirst({
          where: { 
            bankingUserId: effectiveUserId!, 
            consumerNumber: parsedIntent.consumer_number 
          }
        });
        if (saved) {
          parsedIntent.biller_name = saved.billerName;
          parsedIntent.bill_type = saved.billType;
        }
      }

      // 2. Check for saved biller if name is present but number is missing
      if (parsedIntent.biller_name && !parsedIntent.consumer_number) {
        const saved = await db.savedBiller.findFirst({
          where: { 
            bankingUserId: effectiveUserId!, 
            billerName: { contains: parsedIntent.biller_name, mode: 'insensitive' }
          }
        });
        if (saved) {
          parsedIntent.consumer_number = saved.consumerNumber;
          parsedIntent.bill_type = saved.billType;
        }
      }

      // If bill_type is missing, default to MOBILE_RECHARGE if it looks like a recharge
      if (!parsedIntent.bill_type) {
        if (command.toLowerCase().includes("recharge") || command.toLowerCase().includes("mobile")) {
          parsedIntent.bill_type = "MOBILE_RECHARGE";
        } else {
          parsedIntent.bill_type = "ELECTRICITY"; // Safe default for bills
        }
      }

      // If we're missing details, ask for them specifically
      if (!parsedIntent.amount || !parsedIntent.consumer_number || !parsedIntent.biller_name) {
        let missing = [];
        if (!parsedIntent.consumer_number) missing.push("phone/consumer number");
        if (!parsedIntent.amount) missing.push("amount");
        if (!parsedIntent.biller_name) missing.push("biller name (like Airtel, Jio, or Tata Power)");

        let prompt = "I can help with that! ";
        if (parsedIntent.bill_type === "MOBILE_RECHARGE" || parsedIntent.bill_type === "MOBILE_POSTPAID") {
          prompt += "To recharge your phone, I'll need your " + missing.join(", ") + ".";
        } else {
          prompt += "To pay your " + (parsedIntent.bill_type || "bill").toLowerCase().replace('_', ' ') + ", please provide the " + missing.join(", ") + ".";
        }

        return NextResponse.json({
          response: prompt + "\n\nYou can say something like: 'Recharge my Airtel phone 9888888888 with 499 rupees'.",
          preview: null,
          needsMoreInfo: true,
          missingFields: missing,
          intent: "PAY_BILL",
          billType: parsedIntent.bill_type,
          extractedInfo: {
            amount: parsedIntent.amount,
            consumerNumber: parsedIntent.consumer_number,
            billerName: parsedIntent.biller_name
          }
        });
      }

      let accounts;
      try {
        accounts = await bankingAPI.getAccounts();
      } catch (error: any) {
        console.error("❌ [Process Command] Failed to fetch accounts:", error);
        return NextResponse.json({
          response: `Unable to access your accounts: ${error.message}.`,
          preview: null,
        });
      }
      
      if (!accounts || accounts.length === 0) {
        return NextResponse.json({
          response: "No active account found. Please register at the banking app first.",
          preview: null,
        });
      }

      const account = accounts[0];

      try {
        const previewData = await bankingAPI.createBillPreview({
          fromAccountId: account.id,
          billType: parsedIntent.bill_type,
          billerName: parsedIntent.biller_name,
          consumerNumber: parsedIntent.consumer_number,
          amount: parsedIntent.amount,
        });

        // Store the intent in audit log for confirmation phase
        await db.aiAuditLog.updateMany({
          where: { traceId },
          data: { 
            previewId: previewData.previewId,
            parsedIntentJson: JSON.stringify(parsedIntent),
          },
        });

        const explanation = explainAIDecision(parsedIntent.intent, parsedIntent, previewData.rulesResult);

        // Check if this biller is already saved
        const isAlreadySaved = await db.savedBiller.findFirst({
          where: {
            bankingUserId: effectiveUserId!,
            consumerNumber: parsedIntent.consumer_number,
            billerName: parsedIntent.biller_name,
          }
        });

        return NextResponse.json({
          response: explanation + `You're about to pay ₹${previewData.requestedAmount} for your ${parsedIntent.bill_type.toLowerCase().replace('_', ' ')} bill (${parsedIntent.biller_name}) with consumer number ${parsedIntent.consumer_number}. Please confirm to proceed.`,
          voiceMatched: isVoiceMatched,
          voiceExpired,
          preview: {
            previewId: previewData.previewId,
            requestedAmount: previewData.requestedAmount,
            charges: previewData.charges,
            finalDebitAmount: previewData.finalDebitAmount,
            rulesResult: previewData.rulesResult,
            beneficiaryName: `${parsedIntent.bill_type} - ${parsedIntent.biller_name}`,
            method: "BILL_PAY",
            accountNumber: account.accountNumber,
            isBill: true,
            billType: parsedIntent.bill_type,
            billerName: parsedIntent.biller_name,
            consumerNumber: parsedIntent.consumer_number,
            isAlreadySaved: !!isAlreadySaved,
          },
          traceId,
        });
      } catch (previewError: any) {
        console.error("❌ [Process Command] Bill preview failed:", previewError);
        return NextResponse.json({
          response: `Sorry, I couldn't create a bill preview: ${previewError.message}`,
          preview: null,
        });
      }

    } else if (parsedIntent.intent === "CHECK_BALANCE") {
      let accounts;
      try {
        accounts = await bankingAPI.getAccounts();
      } catch (error: any) {
        console.error("Error fetching accounts:", error);
        return NextResponse.json({
          response: `Unable to access your account: ${error.message}. Please ensure you're registered at the banking app (http://localhost:3002/register).`,
        });
      }
      
      if (!accounts || accounts.length === 0) {
        return NextResponse.json({
          response: "No active account found. Please register at the banking app first (http://localhost:3002/register).",
        });
      }

      const account = accounts[0];
      const explanation = explainAIDecision(parsedIntent.intent, parsedIntent);

      return NextResponse.json({
        response: explanation + `Your current balance is ₹${account.balance}.`,
        traceId,
      });

    } else if (parsedIntent.intent === "SHOW_TRANSACTIONS") {
      let transactions;
      try {
        transactions = await bankingAPI.getTransactions(5);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        return NextResponse.json({
          response: `Unable to access your transactions: ${error.message}. Please ensure you're registered at the banking app (http://localhost:3002/register).`,
        });
      }

      if (transactions.length === 0) {
        return NextResponse.json({
          response: "No recent transactions found.",
          traceId,
        });
      }

      const explanation = explainAIDecision(parsedIntent.intent, parsedIntent);
      const txnList = transactions
        .map(
          (txn) =>
            `₹${txn.amount} to ${txn.beneficiary.name} via ${txn.method} - ${txn.status}`
        )
        .join("\n");

      return NextResponse.json({
        response: explanation + `Your last ${transactions.length} transactions:\n${txnList}`,
        traceId,
      });

    } else {
      return NextResponse.json({
        response: "I didn't understand that command. You can ask me to make payments, check balance, or show transactions.",
        traceId,
      });
    }

  } catch (error: any) {
    console.error("Error processing command:", error);
    
    // SAFE LOGGING: Try to log but don't crash if logging itself fails
    try {
      if (effectiveUserId) {
        await logAIAction(
          effectiveUserId,
          "ERROR",
          "command processing",
          { error: error.message },
          { traceId },
          traceId
        );
      }
    } catch (logError) {
      console.error("Failed to log error action:", logError);
    }

    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
        traceId,
      },
      { status: 500 }
    );
  }
}
