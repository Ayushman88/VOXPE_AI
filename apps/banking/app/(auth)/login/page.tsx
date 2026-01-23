"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
    
    // Check if we're in a popup and have a redirect to authorize endpoint
    const redirect = params.get("redirect");
    const isOAuthFlow = redirect && redirect.includes("/api/auth/authorize");
    const isPopup = window.opener !== null;
    
    if (isOAuthFlow && isPopup) {
      console.log("🔐 [Login] OAuth flow detected in popup");
      console.log("🔐 [Login] Redirect URL:", redirect);
    }
    
    // Set OAuth flow state for rendering
    setIsOAuthFlow(!!isOAuthFlow);
    
    // NOTE: We don't auto-redirect based on localStorage token here because:
    // 1. Authentication is done via HTTP-only cookies, not localStorage
    // 2. The authorize endpoint will check the cookie and redirect to login if needed
    // 3. Auto-redirecting here can cause infinite loops if the cookie isn't set
    // The user should manually log in, which will set the cookie and then redirect
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("🔐 [Login] Attempting login...");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Important: include cookies
      });

      const data = await res.json();
      console.log("🔐 [Login] Response status:", res.status, "Data:", data);

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
        console.log("🔐 [Login] Token stored in localStorage");
      }

      // Get redirect parameter from URL - this should be preserved from the authorize endpoint
      // IMPORTANT: We need to get this BEFORE any navigation happens
      const currentUrl = new URL(window.location.href);
      const redirectParam = currentUrl.searchParams.get("redirect");
      
      console.log("🔐 [Login] ========== POST-LOGIN REDIRECT ==========");
      console.log("🔐 [Login] Current URL:", window.location.href);
      console.log("🔐 [Login] All search params:", Array.from(currentUrl.searchParams.entries()));
      console.log("🔐 [Login] Redirect parameter from URL:", redirectParam);
      
      // If no redirect param, default to dashboard
      // But if we're in a popup (OAuth flow), we should NEVER default to dashboard
      const isInPopup = window.opener !== null;
      const redirectUrl = redirectParam || (isInPopup ? null : "/dashboard");
      
      if (!redirectUrl) {
        console.error("❌ [Login] No redirect parameter found and we're in a popup! This is an error.");
        setError("OAuth redirect parameter missing. Please try again.");
        setLoading(false);
        return;
      }
      
      let decodedRedirect = redirectUrl.startsWith("/") ? redirectUrl : decodeURIComponent(redirectUrl);
      
      console.log("🔐 [Login] Login successful, redirecting to:", decodedRedirect);
      console.log("🔐 [Login] Decoded redirect:", decodedRedirect);
      console.log("🔐 [Login] Is popup:", window.opener !== null);
      console.log("🔐 [Login] Is OAuth flow:", decodedRedirect.includes("/api/auth/authorize"));
      
      // If redirect is to an API route (like /api/auth/authorize), use window.location
      // to ensure cookies are sent and it's a full page navigation
      // HTTP-only cookies are set by the server and will be sent automatically
      if (decodedRedirect.startsWith("/api/")) {
        console.log("🔐 [Login] Using full page navigation for API route");
        console.log("🔐 [Login] Full redirect URL:", decodedRedirect);
        console.log("🔐 [Login] This should redirect back to authorize endpoint");
        
        // Show loading state
        setLoading(true);
        setError("");
        
        // Use a longer delay to ensure the HTTP-only cookie is set by the browser
        // The cookie is set in the response headers, so we need to wait for the browser to process it
        setTimeout(() => {
          console.log("🔐 [Login] Navigating to:", decodedRedirect);
          console.log("🔐 [Login] About to redirect - check server logs for authorize endpoint");
          
          // Force a full page reload to ensure cookies are sent
          // Use href instead of replace so we can see if there's an error
          window.location.href = decodedRedirect;
        }, 500); // Increased delay to ensure cookie is definitely set
      } else {
        // For regular pages, use router.push for client-side navigation
        console.log("🔐 [Login] Redirecting to regular page (not API route):", decodedRedirect);
        console.log("🔐 [Login] WARNING: This might be wrong if OAuth flow was expected!");
        router.push(decodedRedirect);
      }
    } catch (err: any) {
      console.error("🔐 [Login] Error:", err);
      setError(err.message || "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Dummy Bank</h1>
          <p className="text-blue-100">Internet Banking Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {isOAuthFlow && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>🔐 OAuth Authorization</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Please login to authorize the AI agent to access your banking account.
              </p>
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
                <span className="text-red-600">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign up here
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-blue-100 hover:text-white text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
