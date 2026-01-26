import { db } from "@voxpe/db-ai";

interface RateLimitEntry {
  userId: string;
  count: number;
  resetAt: Date;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export async function checkRateLimit(
  userId: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const key = `ratelimit:${userId}`;
  const now = new Date();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    entry = {
      userId,
      count: 0,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  
  if (Math.random() < 0.01) {
    const now = new Date();
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

export async function detectFraudulentActivity(
  userId: string,
  action: string,
  metadata: Record<string, any>
): Promise<{ isFraudulent: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  
  if (action === "MAKE_PAYMENT") {
    if (metadata.amount) {
      const amount = parseFloat(metadata.amount);
      if (amount > 50000) {
        reasons.push("Payment amount exceeds normal threshold of ₹50,000");
      }
      if (amount <= 0) {
        reasons.push("Invalid payment amount");
      }
    }
    
    const rateLimit = await checkRateLimit(userId, 3, 30000);
    if (!rateLimit.allowed) {
      reasons.push("Too many payment requests in short time. Please wait a moment.");
    }
    
    const recentPaymentLogs = await db.aiAuditLog.findMany({
      where: {
        userId,
        parsedIntentJson: {
          contains: "MAKE_PAYMENT",
        },
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    
    if (recentPaymentLogs.length >= 5) {
      reasons.push("Too many payment attempts in a short time");
    }
  } else {
    const rateLimit = await checkRateLimit(userId, 20, 60000);
    if (!rateLimit.allowed) {
      reasons.push("Too many requests. Please slow down.");
    }
  }
  
  return {
    isFraudulent: reasons.length > 0,
    reasons,
  };
}

export async function logAIAction(
  userId: string,
  action: string,
  input: string,
  output: any,
  metadata: Record<string, any> = {},
  providedTraceId?: string
): Promise<string> {
  const traceId = providedTraceId || `TRACE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.aiAuditLog.upsert({
    where: { traceId },
    update: {
      userId,
      rawCommandText: input,
      parsedIntentJson: JSON.stringify({
        action,
        ...metadata,
        timestamp: new Date().toISOString(),
      }),
      result: JSON.stringify(output),
    },
    create: {
      userId,
      rawCommandText: input,
      parsedIntentJson: JSON.stringify({
        action,
        ...metadata,
        timestamp: new Date().toISOString(),
      }),
      result: JSON.stringify(output),
      traceId,
    },
  });
  
  return traceId;
}

export function explainAIDecision(
  intent: string,
  parsedData: any,
  rulesResult?: { allowed: boolean; reasons: string[] }
): string {
  let explanation = `I understood your request as: ${intent}. `;
  
  if (intent === "MAKE_PAYMENT") {
    explanation += `You want to pay ₹${parsedData.amount} to ${parsedData.payee_name} via ${parsedData.payment_method || "UPI"}. `;
    
    if (rulesResult) {
      if (rulesResult.allowed) {
        explanation += "This payment is allowed based on your account rules. ";
      } else {
        explanation += `This payment cannot be processed: ${rulesResult.reasons.join(", ")}. `;
      }
    }
  } else if (intent === "CHECK_BALANCE") {
    explanation += "I'll retrieve your current account balance. ";
  } else if (intent === "SHOW_TRANSACTIONS") {
    explanation += "I'll show your recent transaction history. ";
  }
  
  return explanation;
}

export function getTransparentRules(): string {
  return `
Payment Rules (Transparent & Fair):
- Maximum per-transaction: ₹50,000
- Daily limit: ₹100,000
- UPI: Free, Instant
- IMPS: ₹5 for amounts > ₹10,000
- NEFT: ₹2.5 for amounts > ₹10,000
- All rules apply equally to all users
- Rules can be viewed in banking app settings
  `.trim();
}
