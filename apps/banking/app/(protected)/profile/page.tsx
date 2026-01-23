"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Settings, 
  Bell, 
  Shield, 
  FileText,
  LogOut,
  Edit,
  CreditCard,
  Lock
} from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user data from token or API
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Decode token to get user info (for demo, we'll fetch from API)
    fetchUserData(token);
  }, [router]);

  const fetchUserData = async (token: string) => {
    try {
      // In a real app, you'd have a /api/user endpoint
      // For now, we'll get it from accounts endpoint
      const res = await fetch("/api/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        router.replace("/login");
        return;
      }

      // For demo, create user data
      // In production, fetch from /api/user
      setUserData({
        id: "user-1",
        name: "Demo User",
        email: "demo@example.com",
        phone: "+91 9876543210",
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 py-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
              <p className="text-sm text-gray-500">Manage your account settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
          <div className="flex items-center space-x-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-full p-4">
              <User className="h-12 w-12 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{userData?.name || "User"}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>{userData?.email || "N/A"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>{userData?.phone || "N/A"}</span>
                </div>
              </div>
            </div>
            <button className="flex items-center space-x-2 px-4 py-2 border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-colors">
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-4">
          {/* General Settings */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">General</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <Link
                href="#"
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 rounded-xl p-3">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Profile Settings</p>
                    <p className="text-sm text-gray-500">Update your personal information</p>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
              </Link>
              <Link
                href="#"
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-purple-100 rounded-xl p-3">
                    <Bell className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Notifications</p>
                    <p className="text-sm text-gray-500">Manage notification preferences</p>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
              </Link>
              <Link
                href="/statements"
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-green-100 rounded-xl p-3">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Account Statements</p>
                    <p className="text-sm text-gray-500">View and download statements</p>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
              </Link>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <Link
                href="#"
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-red-100 rounded-xl p-3">
                    <Lock className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Change Password</p>
                    <p className="text-sm text-gray-500">Update your account password</p>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
              </Link>
              <Link
                href="#"
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-yellow-100 rounded-xl p-3">
                    <Shield className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-500">Add an extra layer of security</p>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
              </Link>
              <Link
                href="#"
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-100 rounded-xl p-3">
                    <CreditCard className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Manage Cards</p>
                    <p className="text-sm text-gray-500">View and manage your cards</p>
                  </div>
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-400 rotate-180" />
              </Link>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full bg-white rounded-2xl shadow-md p-6 hover:bg-red-50 transition-colors border-2 border-red-100"
          >
            <div className="flex items-center justify-center space-x-3">
              <LogOut className="h-5 w-5 text-red-600" />
              <span className="font-semibold text-red-600">Logout</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

