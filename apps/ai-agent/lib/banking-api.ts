const BANK_API_URL = process.env.BANK_APP_URL || "http://localhost:3002";

export interface BankingAccount {
  id: string;
  type: string;
  accountNumber: string;
  balance: string;
  status: string;
}

export interface BankingBeneficiary {
  id: string;
  name: string;
  upiId: string | null;
  beneficiaryAccountNumber: string | null;
  beneficiaryIfsc: string | null;
  isActive: boolean;
}

export interface BankingTransaction {
  id: string;
  amount: string;
  status: string;
  method: string;
  createdAt: string;
  beneficiary: { name: string };
}

export interface PaymentPreview {
  previewId: string;
  requestedAmount: number;
  charges: number;
  finalDebitAmount: number;
  rulesResult: {
    allowed: boolean;
    reasons: string[];
  };
  expiresAt: string;
}

class BankingAPIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = BANK_API_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  hasToken(): boolean {
    return this.token !== null;
  }

  async login(email: string, password: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Login failed" }));
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();
      this.token = data.token;
      console.log("Login successful");
      return data.token;
    } catch (error: any) {
      console.error("Login error:", error);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (!this.token) {
      throw new Error("Authentication required. Please login first.");
    }

    headers["Authorization"] = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.token = null;
        throw new Error("Authentication expired. Please login again.");
      }
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getAccounts(): Promise<BankingAccount[]> {
    return this.request<BankingAccount[]>("/api/accounts", {
      method: "GET",
    });
  }

  async getBeneficiaries(): Promise<BankingBeneficiary[]> {
    return this.request<BankingBeneficiary[]>("/api/beneficiaries", {
      method: "GET",
    });
  }

  async getTransactions(limit: number = 5): Promise<BankingTransaction[]> {
    const transactions = await this.request<BankingTransaction[]>("/api/transactions", {
      method: "GET",
    });
    return transactions.slice(0, limit);
  }

  async createPaymentPreview(data: {
    fromAccountId: string;
    beneficiaryId: string;
    amount: number;
    method: "UPI" | "IMPS" | "NEFT";
  }): Promise<PaymentPreview> {
    return this.request<PaymentPreview>("/api/payments/preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async executePaymentFromPreview(data: {
    previewId: string;
    consentToken: string;
    bankReferenceId?: string;
    status?: string;
  }): Promise<{ transactionId: string; bankReferenceId: string }> {
    return this.request("/api/payments/execute-from-preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createBeneficiary(data: {
    name: string;
    upiId?: string;
    beneficiaryAccountNumber?: string;
    beneficiaryIfsc?: string;
  }): Promise<BankingBeneficiary> {
    return this.request<BankingBeneficiary>("/api/beneficiaries", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async confirmPaymentPreview(data: {
    previewId: string;
    consentToken: string;
  }): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/payments/confirm-preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createBillPreview(data: {
    fromAccountId: string;
    billType: string;
    billerName: string;
    consumerNumber: string;
    amount: number;
  }): Promise<PaymentPreview> {
    return this.request<PaymentPreview>("/api/bills/preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async executeBillFromPreview(data: {
    previewId: string;
    consentToken: string;
  }): Promise<{ transactionId: string; bankReferenceId: string }> {
    return this.request("/api/bills/execute-from-preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getBillHistory(billType?: string): Promise<any[]> {
    const endpoint = billType ? `/api/bills/history?billType=${billType}` : "/api/bills/history";
    return this.request<any[]>(endpoint, {
      method: "GET",
    });
  }
}

export const bankingAPI = new BankingAPIClient();
