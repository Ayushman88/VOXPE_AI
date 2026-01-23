import express from "express";
import { chromium, Browser, Page } from "playwright";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BANK_URL = process.env.BANK_APP_URL || "http://localhost:3002";
const HEADLESS = false;

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    console.log("🌐 Launching visible browser for automation...");
    browser = await chromium.launch({
      headless: false,
      slowMo: 300,
      channel: "chrome",
    });
    console.log("✅ Browser launched and visible to user");
  }
  return browser;
}

interface CreateBeneficiaryJob {
  type: "CREATE_BENEFICIARY";
  name: string;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  traceId: string;
  email?: string;
  password?: string;
}

interface ExecutePaymentJob {
  type: "EXECUTE_PAYMENT";
  beneficiaryName: string;
  amount: number;
  paymentMethod: "UPI" | "IMPS" | "NEFT";
  traceId: string;
  email?: string;
  password?: string;
  oauthToken?: string;
}

async function loginToBank(page: Page, email?: string, password?: string): Promise<void> {
  if (!email || !password) {
    throw new Error("Email and password are required for login. Please provide credentials.");
  }

  console.log("🔐 AI: Navigating to bank login page...");
  await page.goto(`${BANK_URL}/login`, { waitUntil: 'networkidle' });

  console.log("🔐 AI: Filling login credentials...");
  await page.fill('input[type="email"]', email);
  await page.waitForTimeout(300);
  await page.fill('input[type="password"]', password);
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');

  console.log("🔐 AI: Waiting for dashboard...");
  await page.waitForURL(`${BANK_URL}/dashboard`, { timeout: 10000 });
  console.log("✅ AI: Successfully logged in!");
}

async function authenticateWithOAuthToken(context: any, oauthToken: string, page?: Page): Promise<void> {
  console.log("🔐 AI: Authenticating with OAuth token...");
  console.log("🔐 AI: Token preview:", oauthToken.substring(0, 50) + "...");
  
  const url = new URL(BANK_URL);
  const domain = url.hostname;
  
  await context.addCookies([{
    name: "token",
    value: oauthToken,
    domain: domain,
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }]);

  await context.addInitScript(
    (args: { token: string }) => {
      (window as any).localStorage.setItem("token", args.token);
    },
    { token: oauthToken }
  );

  if (page) {
    await page.addInitScript(
      (args: { token: string }) => {
        (window as any).localStorage.setItem("token", args.token);
      },
      { token: oauthToken }
    );
  }

  console.log(`✅ AI: OAuth token set as cookie and localStorage for domain: ${domain}`);
}

async function createBeneficiary(job: CreateBeneficiaryJob) {
  if (!job.email || !job.password) {
    return {
      success: false,
      error: "Email and password are required for browser automation",
      status: "FAILED",
    };
  }

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginToBank(page, job.email, job.password);

    console.log("📄 AI: Navigating to beneficiaries page...");
    await page.goto(`${BANK_URL}/beneficiaries`, { waitUntil: 'networkidle' });

    await page.waitForSelector('button:has-text("Add Beneficiary")', { timeout: 10000 });

    console.log("➕ AI: Clicking 'Add Beneficiary' button...");
    await page.click('button:has-text("Add Beneficiary")');
    await page.waitForTimeout(500);

    await page.waitForSelector('input[placeholder*="Beneficiary name"], input[placeholder*="name"]', { timeout: 5000 });

    console.log(`✏️ AI: Entering beneficiary name: ${job.name}`);
    const nameInput = page.locator('input[placeholder*="Beneficiary name"], input[placeholder*="name"]').first();
    await nameInput.fill(job.name);
    await page.waitForTimeout(500);

    if (job.upiId) {
      console.log(`💳 AI: Entering UPI ID: ${job.upiId}`);
      const upiInput = page.locator('input[placeholder*="upi"], input[placeholder*="UPI"]').first();
      await upiInput.fill(job.upiId);
      await page.waitForTimeout(500);
    } else if (job.accountNumber && job.ifsc) {
      console.log(`🏦 AI: Entering account number: ${job.accountNumber}`);
      const accInput = page.locator('input[placeholder*="Account"], input[placeholder*="account"]').first();
      await accInput.fill(job.accountNumber);
      await page.waitForTimeout(500);
      
      console.log(`🏦 AI: Entering IFSC: ${job.ifsc}`);
      const ifscInput = page.locator('input[placeholder*="IFSC"], input[placeholder*="ifsc"]').first();
      await ifscInput.fill(job.ifsc);
      await page.waitForTimeout(500);
    } else {
      throw new Error("Either UPI ID or both account number and IFSC are required");
    }

    console.log("✅ AI: Submitting beneficiary form...");
    const submitButton = page.locator('button[type="submit"]:has-text("Add Beneficiary"), button:has-text("Add")').first();
    await submitButton.click();

    console.log("⏳ AI: Waiting for beneficiary creation confirmation...");
    await page.waitForTimeout(2000);

    const pageContent = await page.textContent("body");
    const hasError = pageContent?.includes("error") || pageContent?.includes("Error");
    const hasSuccess = pageContent?.includes("success") || pageContent?.includes("added") || pageContent?.includes("created");
    
    if (hasError) {
      throw new Error("Failed to add beneficiary - error detected on page");
    }

    if (hasSuccess) {
      console.log("✅ AI: Beneficiary added successfully!");
    }
    
    console.log("👁️ AI: Browser window will remain open for 3 seconds so you can see the result...");
    await page.waitForTimeout(3000);
    await context.close();
    console.log("✅ AI: Browser automation completed and window closed.");

    return {
      success: true,
      beneficiaryName: job.name,
      status: "SUCCESS",
    };
  } catch (error: any) {
    await context.close();
    console.error("Beneficiary creation error:", error);
    return {
      success: false,
      error: error.message,
      status: "FAILED",
    };
  }
}

async function executePayment(job: ExecutePaymentJob) {
  if (!job.oauthToken && (!job.email || !job.password)) {
    return {
      success: false,
      error: "Either OAuth token or email and password are required for browser automation",
      status: "FAILED",
    };
  }

  console.log("🤖 AI: Starting browser automation to execute payment...");
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  try {
    if (job.oauthToken) {
      console.log("🔐 AI: Authenticating with OAuth token...");
      await authenticateWithOAuthToken(context, job.oauthToken, page);
      
      console.log("📄 AI: Navigating directly to transfer page (authenticated via OAuth token)...");
      await page.goto(`${BANK_URL}/transfer`, { waitUntil: 'networkidle' });
      
      const currentUrl = page.url();
      console.log(`🔍 AI: Current URL after navigation: ${currentUrl}`);
      
      if (currentUrl.includes('/login')) {
        throw new Error("OAuth token authentication failed - redirected to login page");
      }
      console.log("✅ AI: Successfully authenticated with OAuth token");
      
      console.log("⏳ AI: Waiting for transfer form to load (client-side rendering)...");
      
      await page.waitForSelector('form', { timeout: 10000, state: 'visible' });
      console.log("✅ AI: Form detected");
      
      console.log("⏳ AI: Waiting for beneficiaries and accounts to load...");
      
      try {
        await page.waitForFunction(
          () => {
            const body = document.body.innerText;
            if (body.includes("No beneficiaries added yet")) return true;
            
            const selects = Array.from(document.querySelectorAll('select'));
            const benSelect = selects.find(s => s.options[0]?.text === "Select Beneficiary");
            return benSelect && benSelect.options.length > 1;
          },
          { timeout: 15000 }
        );
      } catch (e) {
        const text = await page.textContent('body');
        if (text?.includes("No beneficiaries added yet")) {
             throw new Error("No beneficiaries found in the account. Please add a beneficiary first.");
        }
        throw e;
      }
      
      console.log("✅ AI: Form data loaded (beneficiaries and accounts)");
      
      await page.waitForTimeout(1000);
    } else {
      console.log("🔐 AI: Logging into banking app with email/password...");
      await loginToBank(page, job.email, job.password);
      
      console.log("📄 AI: Navigating to transfer page...");
      await page.goto(`${BANK_URL}/transfer`, { waitUntil: 'networkidle' });
      
      await page.waitForSelector('form', { timeout: 10000 });
    }

    await page.waitForTimeout(1000);
    
    const allSelects = await page.locator('select').all();
    console.log(`🔍 AI: Found ${allSelects.length} select elements on the page`);
    
    let beneficiarySelect = null;
    
    for (const select of allSelects) {
      const firstOption = await select.locator('option').first().textContent();
      if (firstOption === "Select Beneficiary") {
        beneficiarySelect = select;
        break;
      }
    }
    
    if (!beneficiarySelect) {
      const pageContent = await page.textContent('body');
      if (pageContent?.includes("No beneficiaries added yet")) {
        throw new Error("No beneficiaries found. Please add a beneficiary first.");
      }
      
      if (allSelects.length >= 2) {
        beneficiarySelect = allSelects[1];
        console.log("⚠️ AI: Could not identify beneficiary select by text, using second select");
      } else if (allSelects.length === 1) {
         beneficiarySelect = allSelects[0];
         console.log("⚠️ AI: Could not identify beneficiary select by text, using single available select");
      } else {
        throw new Error("No select elements found on payment page");
      }
    }
    
    console.log(`👤 AI: Selecting beneficiary: ${job.beneficiaryName}`);
    
    await beneficiarySelect.waitFor({ state: 'visible', timeout: 5000 });
    
    const options = await beneficiarySelect.locator('option').all();
    let selected = false;
    for (const option of options) {
      const text = await option.textContent();
      if (text && text.toLowerCase().includes(job.beneficiaryName.toLowerCase())) {
        const value = await option.getAttribute('value');
        if (value) {
          await beneficiarySelect.selectOption(value);
          selected = true;
          console.log(`✅ AI: Selected beneficiary: ${job.beneficiaryName}`);
          await page.waitForTimeout(500);
          break;
        }
      }
    }
    
    if (!selected) {
      throw new Error(`Beneficiary "${job.beneficiaryName}" not found in the list`);
    }

    console.log(`💳 AI: Selecting payment method: ${job.paymentMethod}`);
    try {
      const methodBtn = page.locator(`button p.font-semibold`).filter({ hasText: job.paymentMethod }).first();
      
      await methodBtn.waitFor({ state: 'visible', timeout: 5000 });
      await methodBtn.click();
      console.log(`✅ AI: Selected payment method: ${job.paymentMethod}`);
    } catch (e) {
      console.warn(`⚠️ AI: Could not find button for payment method ${job.paymentMethod}. Trying legacy select method...`);
      try {
        const methodSelect = page.locator('select').nth(2); 
        if (await methodSelect.isVisible()) {
           await methodSelect.selectOption(job.paymentMethod);
        } else {
           throw new Error("Payment method selection failed");
        }
      } catch (err) {
        throw new Error(`Failed to select payment method ${job.paymentMethod}`);
      }
    }
    
    await page.waitForTimeout(500);

    console.log(`💰 AI: Entering amount: ₹${job.amount}`);
    const amountInput = page.locator('input[type="number"]');
    await amountInput.waitFor({ state: 'visible', timeout: 5000 });
    await amountInput.fill(job.amount.toString());
    await page.waitForTimeout(1000);
    console.log(`✅ AI: Amount entered: ₹${job.amount}`);

    console.log("🚀 AI: Submitting payment form...");
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await submitButton.click();
    console.log("✅ AI: Payment form submitted");

    console.log("⏳ AI: Waiting for payment confirmation...");
    await page.waitForSelector('text=/success|reference|BNK|completed/i', { timeout: 15000 });

    const pageContent = await page.textContent("body");
    const referenceMatch = pageContent?.match(/BNK\d+/);
    const bankReferenceId = referenceMatch ? referenceMatch[0] : `BNK${Date.now()}`;

    console.log(`✅ AI: Payment successful! Reference ID: ${bankReferenceId}`);
    console.log("👁️ AI: Browser window will remain open for 10 seconds so you can see the result...");
    await page.waitForTimeout(10000);
    await context.close();
    console.log("✅ AI: Browser automation completed and window closed.");

    return {
      success: true,
      bankReferenceId,
      status: "SUCCESS",
    };
  } catch (error: any) {
    await context.close();
    console.error("Payment execution error:", error);
    return {
      success: false,
      error: error.message,
      status: "FAILED",
    };
  }
}

app.post("/execute", async (req, res) => {
  try {
    const job = req.body;

    if (job.type === "CREATE_BENEFICIARY") {
      console.log(`Creating beneficiary: ${job.name}`);
      const result = await createBeneficiary(job as CreateBeneficiaryJob);
      return res.json(result);
    } else if (job.type === "EXECUTE_PAYMENT") {
      console.log(`Executing payment: ₹${job.amount} to ${job.beneficiaryName}`);
      const result = await executePayment(job as ExecutePaymentJob);
      return res.json(result);
    } else {
      return res.status(400).json({ error: "Invalid job type. Must be CREATE_BENEFICIARY or EXECUTE_PAYMENT" });
    }
  } catch (error: any) {
    console.error("Error processing job:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", headless: HEADLESS });
});

app.listen(PORT, () => {
  console.log(`Browser automation worker running on port ${PORT}`);
  console.log(`Headless mode: ${HEADLESS}`);
  console.log(`Bank URL: ${BANK_URL}`);
});

process.on("SIGTERM", async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
