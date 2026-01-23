"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft,
  Download,
  Filter,
  Search,
  Calendar,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown
} from "lucide-react";

interface Transaction {
  id: string;
  amount: string;
  status: string;
  method: string;
  createdAt: string;
  beneficiary: { name: string };
  bankReferenceId?: string;
}

export default function StatementsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchTransactions(token);
    } else {
      router.push("/login");
    }
  }, [router]);

  const fetchTransactions = async (token: string) => {
    try {
      const res = await fetch("/api/transactions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        router.replace("/login");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        setFilteredTransactions(data);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...transactions];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (txn) =>
          txn.beneficiary.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          txn.bankReferenceId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          txn.amount.includes(searchQuery)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((txn) => txn.status === filterStatus);
    }

    // Method filter
    if (filterMethod !== "all") {
      filtered = filtered.filter((txn) => txn.method === filterMethod);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((txn) => {
        const txnDate = new Date(txn.createdAt);
        switch (dateFilter) {
          case "today":
            return txnDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return txnDate >= weekAgo;
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return txnDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    setFilteredTransactions(filtered);
  }, [searchQuery, filterStatus, filterMethod, dateFilter, transactions]);

  const groupTransactionsByDate = (txns: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    txns.forEach((txn) => {
      const date = new Date(txn.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = "Yesterday";
      } else {
        key = date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(txn);
    });
    return groups;
  };

  const exportStatement = () => {
    const csv = [
      ['Date', 'Beneficiary', 'Amount', 'Method', 'Status', 'Reference ID'].join(','),
      ...filteredTransactions.map(txn => [
        new Date(txn.createdAt).toLocaleDateString(),
        txn.beneficiary.name,
        txn.amount,
        txn.method,
        txn.status,
        txn.bankReferenceId || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const groupedTransactions = groupTransactionsByDate(filteredTransactions);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading statements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Account Statements</h1>
                <p className="text-sm text-gray-500">{filteredTransactions.length} transactions</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={exportStatement}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Filter className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by beneficiary, amount, or reference ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center">
            <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium text-lg mb-2">No transactions found</p>
            <p className="text-gray-400 text-sm">
              {searchQuery || filterStatus !== "all" || filterMethod !== "all" || dateFilter !== "all"
                ? "Try adjusting your filters"
                : "Your transaction history will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, txns]) => (
              <div key={date}>
                <div className="flex items-center space-x-2 mb-4">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{date}</h3>
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-500">{txns.length} transaction{txns.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                  {txns.map((txn, index) => (
                    <div
                      key={txn.id}
                      className={`p-5 hover:bg-gray-50 transition-colors ${
                        index !== txns.length - 1 ? "border-b border-gray-100" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
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
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-semibold text-gray-900">{txn.beneficiary.name}</p>
                              {txn.bankReferenceId && (
                                <span className="text-xs text-gray-400">#{txn.bankReferenceId}</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 mt-1">
                              <span className="text-sm text-gray-500">{txn.method}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm text-gray-500">
                                {new Date(txn.createdAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            txn.status === "SUCCESS" ? "text-red-600" : txn.status === "FAILED" ? "text-gray-400" : "text-yellow-600"
                          }`}>
                            {txn.status === "SUCCESS" ? "-" : txn.status === "FAILED" ? "" : "-"}₹{parseFloat(txn.amount).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                            txn.status === "SUCCESS"
                              ? "bg-green-100 text-green-700"
                              : txn.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {txn.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

