"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Simple UUID generator for state parameter
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const state = searchParams.get("state");

    if (errorParam) {
      setStatus("error");
      setError(errorParam === "access_denied" ? "Authorization was denied" : errorParam);
      return;
    }

    if (!code) {
      setStatus("error");
      setError("No authorization code received");
      return;
    }

    // Exchange authorization code for access token
    exchangeCodeForToken(code, state);
  }, [searchParams]);

  const exchangeCodeForToken = async (code: string, state: string | null) => {
    try {
      // Generate PKCE code verifier (if we had sent code_challenge)
      // For simplicity, we'll skip PKCE for now, but it's recommended for production

      const response = await fetch("http://localhost:3002/api/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: "http://localhost:3000/auth/callback",
          client_id: "ai-agent",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || "Token exchange failed");
      }

      // Store tokens securely in localStorage for persistence across page reloads
      if (data.access_token) {
        const expiresAt = Date.now() + (data.expires_in * 1000);
        localStorage.setItem("oauthAccessToken", data.access_token);
        if (data.refresh_token) {
          localStorage.setItem("oauthRefreshToken", data.refresh_token);
        }
        localStorage.setItem("oauthScopes", data.scope || "");
        localStorage.setItem("oauthExpiresAt", String(expiresAt));
        console.log("💾 [Auth Callback] Token stored in localStorage, expires at:", new Date(expiresAt).toLocaleString());
      }

      setStatus("success");

      // If opened in popup, notify parent window and close
      if (window.opener && !window.opener.closed) {
        console.log("📤 Sending OAUTH_SUCCESS message to parent window");
        
        // Send message to parent window
        // Try multiple times to ensure it's received
        const expiresAt = Date.now() + (data.expires_in * 1000);
        const sendMessage = () => {
          try {
        window.opener.postMessage(
          {
            type: "OAUTH_SUCCESS",
            token: data.access_token,
            scopes: data.scope || "",
            expiresAt: String(expiresAt),
          },
          "http://localhost:3000"
        );
            console.log("✅ Message sent to parent window");
          } catch (error) {
            console.error("❌ Error sending message:", error);
          }
        };

        // Send immediately
        sendMessage();
        
        // Send again after a short delay to ensure it's received
        setTimeout(sendMessage, 100);
        setTimeout(sendMessage, 500);
        
        // Close popup after ensuring message is sent
        setTimeout(() => {
          console.log("🔒 Closing popup window");
          window.close();
        }, 1500);
      } else {
        // Not in popup, redirect to home page
        console.log("🔄 Not in popup, redirecting to home");
        setTimeout(() => {
          router.push("/");
        }, 2000);
      }
    } catch (err: any) {
      console.error("Token exchange error:", err);
      setStatus("error");
      const errorMessage = err.message || "Failed to exchange authorization code for token";
      setError(errorMessage);
      
      // If opened in popup, notify parent window of error
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            {
              type: "OAUTH_ERROR",
              error: errorMessage,
            },
            "http://localhost:3000"
          );
          setTimeout(() => {
            window.close();
          }, 2000);
        } catch (postError) {
          console.error("Error sending error message:", postError);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {status === "loading" && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorizing...</h2>
            <p className="text-gray-600">Exchanging authorization code for access token</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorization Successful!</h2>
            <p className="text-gray-600 mb-4">You've successfully authorized the AI agent.</p>
            <p className="text-sm text-gray-500">Redirecting to home page...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorization Failed</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

