"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, CreditCard, User, CheckCircle2, XCircle } from "lucide-react";

interface Beneficiary {
  id: string;
  name: string;
  upiId: string | null;
  beneficiaryAccountNumber: string | null;
}

interface Account {
  id: string;
  accountNumber: string;
  type: string;
  balance: string;
}

export default function TransferPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"UPI" | "IMPS" | "NEFT">("UPI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchData(token);
    }
  }, [router]);

  const fetchData = async (token: string) => {
    try {
      const [accountsRes, beneficiariesRes] = await Promise.all([
        fetch("/api/accounts", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/beneficiaries", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData);
        if (accountsData.length > 0) {
          setSelectedAccount(accountsData[0].id);
        }
      }

      if (beneficiariesRes.ok) {
        const beneficiariesData = await beneficiariesRes.json();
        setBeneficiaries(beneficiariesData.filter((b: Beneficiary) => b.isActive));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("/api/payments/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromAccountId: selectedAccount,
          beneficiaryId: selectedBeneficiary,
          amount: parseFloat(amount),
          method,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      setSuccess(`Payment successful! Reference ID: ${data.bankReferenceId}`);
      setAmount("");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedAccountData = accounts.find((acc) => acc.id === selectedAccount);
  const selectedBeneficiaryData = beneficiaries.find((ben) => ben.id === selectedBeneficiary);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 py-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Send Money</h1>
              <p className="text-sm text-gray-500">Transfer funds securely</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center space-x-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center space-x-3">
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* From Account Card */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              From Account
            </label>
            {selectedAccountData && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 rounded-lg p-2">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-100">{selectedAccountData.type}</p>
                      <p className="font-semibold tracking-wider">
                        {selectedAccountData.accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-100">Available Balance</p>
                    <p className="text-xl font-bold">
                      ₹{parseFloat(selectedAccountData.balance).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {accounts.length > 1 && (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="mt-4 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type} - {acc.accountNumber}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* To Beneficiary */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              To Beneficiary
            </label>
            {beneficiaries.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No beneficiaries added yet</p>
                <Link
                  href="/beneficiaries"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Add Beneficiary →
                </Link>
              </div>
            ) : (
              <>
                <select
                  value={selectedBeneficiary}
                  onChange={(e) => setSelectedBeneficiary(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                >
                  <option value="">Select Beneficiary</option>
                  {beneficiaries.map((ben) => (
                    <option key={ben.id} value={ben.id}>
                      {ben.name} {ben.upiId ? `(${ben.upiId})` : ""}
                    </option>
                  ))}
                </select>
                {selectedBeneficiaryData && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 rounded-full p-3">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{selectedBeneficiaryData.name}</p>
                        {selectedBeneficiaryData.upiId && (
                          <p className="text-sm text-gray-500">UPI: {selectedBeneficiaryData.upiId}</p>
                        )}
                        {selectedBeneficiaryData.beneficiaryAccountNumber && (
                          <p className="text-sm text-gray-500">
                            Account: {selectedBeneficiaryData.beneficiaryAccountNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["UPI", "IMPS", "NEFT"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    method === m
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <p className="font-semibold">{m}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {m === "UPI" ? "Instant" : m === "IMPS" ? "Real-time" : "Next day"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl font-bold text-gray-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {selectedAccountData && amount && parseFloat(amount) > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Available Balance:</span>
                  <span className="font-semibold text-gray-900">
                    ₹{parseFloat(selectedAccountData.balance).toLocaleString('en-IN')}
                  </span>
                </div>
                {parseFloat(amount) > parseFloat(selectedAccountData.balance) && (
                  <p className="text-red-600 text-xs mt-2">Insufficient balance</p>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedBeneficiary || !amount || (selectedAccountData && parseFloat(amount) > parseFloat(selectedAccountData.balance))}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Send Money</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
