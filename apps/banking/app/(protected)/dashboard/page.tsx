"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Wallet, 
  TrendingUp,
  Settings,
  Bell,
  Search,
  Send,
  UserPlus,
  FileText,
  MoreVertical,
  Eye,
  EyeOff
} from "lucide-react";

interface Account {
  id: string;
  type: string;
  accountNumber: string;
  balance: string;
}

interface Transaction {
  id: string;
  amount: string;
  status: string;
  method: string;
  createdAt: string;
  beneficiary: { name: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchAccountData(token);
    } else {
      router.push("/login");
    }
  }, [router]);

  const fetchAccountData = async (token: string) => {
    try {
      const [accountRes, transactionsRes] = await Promise.all([
        fetch("/api/accounts", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/transactions", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (accountRes.status === 401 || transactionsRes.status === 401) {
        localStorage.removeItem("token");
        router.replace("/login");
        return;
      }

      if (accountRes.ok) {
        const accountData = await accountRes.json();
        setAccount(accountData[0] || null);
      }

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.slice(0, 5));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      localStorage.removeItem("token");
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("token");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    router.push("/");
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatAccountNumber = (accNum: string) => {
    return accNum.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-3">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dummy Bank</h1>
                <p className="text-sm text-gray-500">Internet Banking</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/statements"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Statements"
              >
                <FileText className="h-5 w-5 text-gray-600" />
              </Link>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Notifications">
                <Bell className="h-5 w-5 text-gray-600" />
              </button>
              <Link
                href="/profile"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Profile"
              >
                <Settings className="h-5 w-5 text-gray-600" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Card */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-2">Available Balance</p>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-4xl font-bold">
                      {showBalance ? formatBalance(account?.balance || "0") : "₹••••••"}
                    </h2>
                    <button
                      onClick={() => setShowBalance(!showBalance)}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                      {showBalance ? (
                        <Eye className="h-5 w-5" />
                      ) : (
                        <EyeOff className="h-5 w-5 opacity-50" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <CreditCard className="h-8 w-8" />
                </div>
              </div>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/20">
                <div>
                  <p className="text-blue-100 text-xs mb-1">Account Number</p>
                  <p className="text-lg font-semibold tracking-wider">
                    {account ? formatAccountNumber(account.accountNumber) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-blue-100 text-xs mb-1">Account Type</p>
                  <p className="text-lg font-semibold">{account?.type || "N/A"}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-12 h-8 bg-white/20 rounded flex items-center justify-center">
                    <span className="text-xs font-bold">VISA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/transfer"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-all hover:-translate-y-1 group"
          >
            <div className="bg-blue-100 rounded-xl p-3 w-fit mb-4 group-hover:bg-blue-200 transition-colors">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Send Money</h3>
            <p className="text-xs text-gray-500">Transfer funds</p>
          </Link>

          <Link
            href="/beneficiaries"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-all hover:-translate-y-1 group"
          >
            <div className="bg-green-100 rounded-xl p-3 w-fit mb-4 group-hover:bg-green-200 transition-colors">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Beneficiaries</h3>
            <p className="text-xs text-gray-500">Manage contacts</p>
          </Link>

          <Link
            href="/statements"
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-all hover:-translate-y-1 group"
          >
            <div className="bg-purple-100 rounded-xl p-3 w-fit mb-4 group-hover:bg-purple-200 transition-colors">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Statements</h3>
            <p className="text-xs text-gray-500">View history</p>
          </Link>

          <button className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-all hover:-translate-y-1 group">
            <div className="bg-orange-100 rounded-xl p-3 w-fit mb-4 group-hover:bg-orange-200 transition-colors">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Analytics</h3>
            <p className="text-xs text-gray-500">View insights</p>
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
            <Link
              href="/statements"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No transactions yet</p>
              <p className="text-gray-400 text-sm mt-1">Your transaction history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`rounded-full p-3 ${
                      txn.status === "SUCCESS" 
                        ? "bg-green-100" 
                        : txn.status === "FAILED"
                        ? "bg-red-100"
                        : "bg-yellow-100"
                    }`}>
                      {txn.status === "SUCCESS" ? (
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowDownLeft className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{txn.beneficiary.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} • {txn.method}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className={`font-bold ${
                        txn.status === "SUCCESS" ? "text-red-600" : txn.status === "FAILED" ? "text-gray-400" : "text-yellow-600"
                      }`}>
                        {txn.status === "SUCCESS" ? "-" : txn.status === "FAILED" ? "" : "-"}₹{parseFloat(txn.amount).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        txn.status === "SUCCESS"
                          ? "bg-green-100 text-green-700"
                          : txn.status === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {txn.status}
                      </span>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <MoreVertical className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

