const BROWSER_AUTOMATION_URL = process.env.BROWSER_AUTOMATION_URL || "http://localhost:3001";

export interface CreateBeneficiaryRequest {
  name: string;
  upiId?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  traceId: string;
}

export interface ExecutePaymentRequest {
  beneficiaryName: string;
  amount: number;
  paymentMethod: "UPI" | "IMPS" | "NEFT";
  traceId: string;
  email?: string;
  password?: string;
  oauthToken?: string;
}

export interface BrowserAutomationResponse {
  success: boolean;
  status: "SUCCESS" | "FAILED";
  error?: string;
  bankReferenceId?: string;
  beneficiaryName?: string;
}

class BrowserAutomationClient {
  private baseUrl: string;

  constructor(baseUrl: string = BROWSER_AUTOMATION_URL) {
    this.baseUrl = baseUrl;
  }

  async createBeneficiary(request: CreateBeneficiaryRequest): Promise<BrowserAutomationResponse> {
    try {
      console.log(`🌐 [Browser Automation Client] Creating beneficiary: ${request.name}`);
      console.log(`🌐 [Browser Automation Client] Calling worker at: ${this.baseUrl}/execute`);
      console.log(`🌐 [Browser Automation Client] Request:`, {
        type: "CREATE_BENEFICIARY",
        name: request.name,
        upiId: request.upiId,
        accountNumber: request.accountNumber,
        ifsc: request.ifsc,
      });
      
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CREATE_BENEFICIARY",
          name: request.name,
          upiId: request.upiId || null,
          accountNumber: request.accountNumber || null,
          ifsc: request.ifsc || null,
          traceId: request.traceId,
          email: request.email,
          password: request.password,
          bankUrl: process.env.BANK_APP_URL || "http://localhost:3002",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Browser Automation] Worker responded with status ${response.status}:`, errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || "Unknown error" };
        }
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ [Browser Automation] Beneficiary creation result:`, result);
      return result;
    } catch (error: any) {
      console.error(`❌ [Browser Automation] Error creating beneficiary:`, error);
      console.error(`❌ [Browser Automation] Error details:`, error.message);
      console.error(`❌ [Browser Automation] Make sure the worker is running on ${this.baseUrl}`);
      return {
        success: false,
        status: "FAILED",
        error: error.message || "Failed to create beneficiary via browser automation. Is the worker running?",
      };
    }
  }

  async executePayment(request: ExecutePaymentRequest): Promise<BrowserAutomationResponse> {
    try {
      console.log(`🌐 [Browser Automation Client] Executing payment: ₹${request.amount} to ${request.beneficiaryName}`);
      console.log(`🌐 [Browser Automation Client] Calling worker at: ${this.baseUrl}/execute`);
      
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "EXECUTE_PAYMENT",
          beneficiaryName: request.beneficiaryName,
          amount: request.amount,
          paymentMethod: request.paymentMethod,
          traceId: request.traceId,
          email: request.email,
          password: request.password,
          oauthToken: request.oauthToken,
          bankUrl: process.env.BANK_APP_URL || "http://localhost:3002",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Browser Automation] Worker responded with status ${response.status}:`, errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || "Unknown error" };
        }
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ [Browser Automation] Payment execution result:`, result);
      return result;
    } catch (error: any) {
      console.error(`❌ [Browser Automation] Error executing payment:`, error);
      console.error(`❌ [Browser Automation] Error details:`, error.message);
      console.error(`❌ [Browser Automation] Make sure the worker is running on ${this.baseUrl}`);
      return {
        success: false,
        status: "FAILED",
        error: error.message || "Failed to execute payment via browser automation. Is the worker running?",
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const browserAutomation = new BrowserAutomationClient();
