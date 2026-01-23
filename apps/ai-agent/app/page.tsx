"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, CheckCircle2, XCircle, Lock, LogOut } from "lucide-react";

interface PaymentPreview {
  previewId: string;
  requestedAmount: number;
  charges: number;
  finalDebitAmount: number;
  rulesResult: {
    allowed: boolean;
    reasons: string[];
  };
  beneficiaryName: string;
  method: string;
  accountNumber: string;
}

interface BeneficiaryDetailsRequest {
  beneficiaryName: string;
  amount: number;
  paymentMethod: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [oauthScopes, setOauthScopes] = useState<string>("");
  const [showLogin, setShowLogin] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsBeneficiaryDetails, setNeedsBeneficiaryDetails] = useState<BeneficiaryDetailsRequest | null>(null);
  const [beneficiaryFormData, setBeneficiaryFormData] = useState({
    upiId: "",
    accountNumber: "",
    ifsc: "",
  });
  const [collectingBeneficiaryDetails, setCollectingBeneficiaryDetails] = useState(false);
  const [listeningForBeneficiary, setListeningForBeneficiary] = useState(false);
  const listeningForBeneficiaryRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const pendingPaymentCommandRef = useRef<string | null>(null);

  // Check for existing OAuth token on mount (using localStorage for persistence)
  useEffect(() => {
    const storedToken = localStorage.getItem("oauthAccessToken");
    const storedScopes = localStorage.getItem("oauthScopes");
    const expiresAt = localStorage.getItem("oauthExpiresAt");

    if (storedToken && expiresAt) {
      // Check if token is still valid
      if (Date.now() < parseInt(expiresAt)) {
        setAuthToken(storedToken);
        setOauthScopes(storedScopes || "");
        setIsAuthenticated(true);
        setShowLogin(false);
        console.log("✅ [Auth] Restored authentication from localStorage");
      } else {
        // Token expired, clear it
        console.log("⏰ [Auth] Token expired, clearing...");
        localStorage.removeItem("oauthAccessToken");
        localStorage.removeItem("oauthRefreshToken");
        localStorage.removeItem("oauthScopes");
        localStorage.removeItem("oauthExpiresAt");
      }
    } else {
      console.log("ℹ️ [Auth] No stored token found");
    }
  }, []);

  // Simple UUID generator for state parameter
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleAuthorize = () => {
    // Use popup window for OAuth2 authorization (better UX)
    const state = generateUUID();
    const authUrl = new URL("http://localhost:3002/api/auth/authorize");
    authUrl.searchParams.set("client_id", "ai-agent");
    authUrl.searchParams.set("redirect_uri", "http://localhost:3000/auth/callback");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "payments read_balance read_transactions read_beneficiaries");
    authUrl.searchParams.set("state", state);

    console.log("Opening OAuth popup:", authUrl.toString());

    // Store state for verification
    localStorage.setItem("oauthState", state);

    // Open popup window
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      authUrl.toString(),
      "Authorize AI Agent",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      setError("Popup blocked! Please allow popups for this site and try again.");
      return;
    }

    // Store popup reference for cleanup
    let popupCheckInterval: NodeJS.Timeout | null = null;
    let popupTimeout: NodeJS.Timeout | null = null;

    // Listen for authorization completion
    popupCheckInterval = setInterval(() => {
      try {
        // Check if popup was closed
        if (popup.closed) {
          if (popupCheckInterval) clearInterval(popupCheckInterval);
          if (popupTimeout) clearTimeout(popupTimeout);
          
          // Give a moment for localStorage to be updated by callback page
          setTimeout(() => {
          // Check if we got the token (user might have completed auth)
          const token = localStorage.getItem("oauthAccessToken");
          if (token) {
              console.log("✅ Popup closed and token found, updating UI");
            setAuthToken(token);
            setIsAuthenticated(true);
              setShowLogin(false);
            const scopes = localStorage.getItem("oauthScopes");
            if (scopes) setOauthScopes(scopes);
            setAiResponse("✅ Successfully authorized! You can now use voice commands.");
              setError(""); // Clear any errors
            } else {
              console.log("⚠️ Popup closed but no token found - user may have cancelled");
          }
          }, 500); // Wait 500ms for localStorage to be updated
          return;
        }
      } catch (e) {
        // Ignore cross-origin errors
      }
    }, 500);

    // Cleanup after 5 minutes
    popupTimeout = setTimeout(() => {
      if (!popup.closed) {
        console.log("⏰ Popup timeout, closing popup");
        popup.close();
      }
      if (popupCheckInterval) clearInterval(popupCheckInterval);
    }, 5 * 60 * 1000);
  };

  const handleLogout = async () => {
    // Revoke token if possible
    const token = localStorage.getItem("oauthAccessToken");
    if (token) {
      try {
        await fetch("http://localhost:3002/api/auth/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch (err) {
        console.error("Token revocation error:", err);
      }
    }

    // Clear all OAuth data
    localStorage.removeItem("oauthAccessToken");
    localStorage.removeItem("oauthRefreshToken");
    localStorage.removeItem("oauthScopes");
    localStorage.removeItem("oauthExpiresAt");

    setAuthToken(null);
    setOauthScopes("");
    setIsAuthenticated(false);
    setShowLogin(true);
    setAiResponse("");
    setPreview(null);
  };

  // Listen for OAuth success message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("📨 Received message:", event.origin, event.data);
      
      // Verify origin for security - allow both localhost:3000 and localhost:3002
      const allowedOrigins = ["http://localhost:3000", "http://localhost:3002"];
      if (!allowedOrigins.includes(event.origin)) {
        console.log("⚠️ Message from unauthorized origin:", event.origin);
        return;
      }

      if (event.data && event.data.type === "OAUTH_SUCCESS") {
        console.log("✅ OAuth authorization successful! Token received");
        if (event.data.token) {
          localStorage.setItem("oauthAccessToken", event.data.token);
          setAuthToken(event.data.token);
          setIsAuthenticated(true);
          setShowLogin(false);
        }
        if (event.data.scopes) {
          localStorage.setItem("oauthScopes", event.data.scopes);
          setOauthScopes(event.data.scopes);
        }
        if (event.data.expiresAt) {
          localStorage.setItem("oauthExpiresAt", event.data.expiresAt);
        }
        setAiResponse("✅ Successfully authorized! You can now use voice commands.");
        setError(""); // Clear any previous errors
      } else if (event.data && event.data.type === "OAUTH_ERROR") {
        console.error("❌ OAuth error:", event.data.error);
        setError(event.data.error || "Authorization failed");
      }
    };

    window.addEventListener("message", handleMessage);
    console.log("👂 Message listener attached");
    
    return () => {
      window.removeEventListener("message", handleMessage);
      console.log("🔇 Message listener removed");
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          finalTranscriptRef.current = finalTranscript.trim();
          setTranscript(finalTranscript.trim());
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        const command = finalTranscriptRef.current || transcript;
        if (command) {
          if (listeningForBeneficiaryRef.current) {
            handleBeneficiaryVoiceInput(command);
            setListeningForBeneficiary(false);
            listeningForBeneficiaryRef.current = false;
          } else {
            console.log("Processing command:", command);
            handleVoiceCommand(command);
          }
        } else {
          setListeningForBeneficiary(false);
          listeningForBeneficiaryRef.current = false;
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setError(`Speech recognition error: ${event.error}. Please try again.`);
      };

      recognitionRef.current = recognition;
    } else {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript("");
      setAiResponse("");
      setPreview(null);
      setError("");
      finalTranscriptRef.current = "";
      setIsListening(true);
      try {
        recognitionRef.current.start();
        console.log("Started listening...");
      } catch (err) {
        console.error("Error starting recognition:", err);
        setError("Failed to start voice recognition. Please try again.");
        setIsListening(false);
      }
    } else {
      setError("Speech recognition not supported in this browser. Please use Chrome or Edge.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleVoiceCommand = async (command: string) => {
    if (!command || command.trim().length === 0) {
      console.log("Empty command, skipping");
      return;
    }

    console.log("🎤 [Voice Command] Checking authentication...");
    console.log("🎤 [Voice Command] isAuthenticated:", isAuthenticated);
    console.log("🎤 [Voice Command] authToken:", authToken ? `${authToken.substring(0, 20)}...` : "null");
    
    // Always check localStorage first - it's the source of truth
    const storedToken = localStorage.getItem("oauthAccessToken");
    const storedScopes = localStorage.getItem("oauthScopes");
    const expiresAt = localStorage.getItem("oauthExpiresAt");
    
    console.log("🎤 [Voice Command] localStorage token:", storedToken ? "exists" : "missing");
    
    // Determine the actual token to use (prefer localStorage over state)
    let tokenToUse = authToken || storedToken;
    
    // If we found a token in localStorage but state is out of sync, update state
    if (storedToken && (!authToken || !isAuthenticated)) {
      console.log("🔄 [Voice Command] Token found in localStorage but state is out of sync, updating state...");
      setAuthToken(storedToken);
      if (storedScopes) setOauthScopes(storedScopes);
      setIsAuthenticated(true);
      setShowLogin(false);
      tokenToUse = storedToken;
    }
    
    // Check if token is expired
    if (tokenToUse && expiresAt) {
      if (Date.now() >= parseInt(expiresAt)) {
        console.error("❌ [Voice Command] Token expired");
        localStorage.removeItem("oauthAccessToken");
        localStorage.removeItem("oauthRefreshToken");
        localStorage.removeItem("oauthScopes");
        localStorage.removeItem("oauthExpiresAt");
        setAuthToken(null);
        setIsAuthenticated(false);
        setError("Your session has expired. Please authorize again.");
        setAiResponse("🔒 Your authorization has expired. Please click 'Authorize with Banking App' again.");
        return;
      }
    }

    if (!tokenToUse) {
      console.error("❌ [Voice Command] No authentication token found in state or sessionStorage");
      setError("Please login first to use voice commands.");
      setAiResponse("🔒 I need your banking credentials to process commands. Please login using the form above.");
      return;
    }
    
    // Use the token we determined (from state or sessionStorage)
    const finalToken = tokenToUse;

    console.log("🎤 [Voice Command] Handling voice command:", command);
    console.log("🎤 [Voice Command] Using token:", finalToken ? `${finalToken.substring(0, 30)}...` : "null");
    setLoading(true);
    setError("");

    try {
      const requestHeaders: HeadersInit = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalToken}`,
      };
      
      console.log("✅ [Voice Command] Authorization header set with token");
      
      console.log("📤 [Voice Command] Sending request to /api/ai/process-command");
      const res = await fetch("/api/ai/process-command", {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ command }),
      });

      console.log("📥 [Voice Command] API response status:", res.status);
      console.log("📥 [Voice Command] API response ok:", res.ok);

      const data = await res.json();
      console.log("📥 [Voice Command] API response data:", data);

      if (!res.ok) {
        throw new Error(data.error || "Failed to process command");
      }

      setAiResponse(data.response || "Command processed");

      if (data.preview) {
        setPreview(data.preview);
      }

      // Check if beneficiary details are needed
      if (data.needsBeneficiaryDetails) {
        setNeedsBeneficiaryDetails({
          beneficiaryName: data.beneficiaryName,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
        });
        // Store the original command to retry after adding beneficiary
        pendingPaymentCommandRef.current = command;
      }
    } catch (err: any) {
      console.error("Error processing command:", err);
      setError(err.message || "Failed to process command. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!preview) return;

    setLoading(true);
    setError("");
    setAiResponse("🤖 AI: Opening browser to execute your payment... You'll see me working in a new browser window!");

    try {
      // For demo: create a simple JWT-like token
      // In production, this should come from proper authentication
      const demoUserId = "demo-user-id";
      const JWT_SECRET = "your-secret-key-change-in-production";
      
      // Create a simple demo token (base64 encoded JSON)
      // The server will decode this and use demo-user-id
      const tokenPayload = { userId: demoUserId, type: "demo", iat: Date.now() };
      const token = btoa(JSON.stringify(tokenPayload));

      if (!authToken) {
        throw new Error("Not authenticated. Please login first.");
      }

      const res = await fetch("/api/ai/confirm-payment", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ previewId: preview.previewId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment confirmation failed");
      }

      setAiResponse(`✅ Payment successful! Reference ID: ${data.bankReferenceId}\n\n🤖 I completed the payment in the browser window. You should have seen me:\n- Logging into the banking app\n- Selecting the beneficiary\n- Entering the amount\n- Submitting the payment`);
      setPreview(null);
    } catch (err: any) {
      console.error("Payment confirmation error:", err);
      const errorMessage = err.message || "Payment confirmation failed";
      
      // Check if it's a worker connection error
      if (errorMessage.includes("worker") || errorMessage.includes("localhost:3001")) {
        setError(`${errorMessage}\n\n⚠️ Make sure the browser automation worker is running:\ncd workers/browser-automation && npm run dev`);
      } else if (errorMessage.includes("Preview not found")) {
        setError(`${errorMessage}\n\n💡 Try creating a new payment command.`);
      } else {
        setError(errorMessage);
      }
      setAiResponse("❌ Payment failed. Please check the error message above for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = () => {
    setPreview(null);
    setAiResponse("Payment cancelled.");
  };

  const handleCreateBeneficiary = async () => {
    if (!needsBeneficiaryDetails) return;

    const { beneficiaryName } = needsBeneficiaryDetails;
    const { upiId, accountNumber, ifsc } = beneficiaryFormData;

    // Validate: need either UPI ID or account details
    if (!upiId && (!accountNumber || !ifsc)) {
      setError("Please provide either UPI ID or both Account Number and IFSC code.");
      return;
    }

    setLoading(true);
    setError("");
    setAiResponse("🤖 AI: Opening browser to add beneficiary... You'll see me working in a new browser window!");

    try {
      const res = await fetch("/api/ai/create-beneficiary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: beneficiaryName,
          upiId: upiId || undefined,
          beneficiaryAccountNumber: accountNumber || undefined,
          beneficiaryIfsc: ifsc || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || "Failed to create beneficiary";
        // Check if it's a worker connection error
        if (errorMsg.includes("worker") || errorMsg.includes("localhost:3001")) {
          throw new Error(`${errorMsg}\n\n⚠️ Make sure the browser automation worker is running:\ncd workers/browser-automation && npm run dev`);
        }
        throw new Error(errorMsg);
      }

      setAiResponse(`✅ Great! I've added ${beneficiaryName} to your beneficiaries via browser automation. You should have seen me working in a browser window!\n\nNow let me process your payment...`);
      setNeedsBeneficiaryDetails(null);
      setBeneficiaryFormData({ upiId: "", accountNumber: "", ifsc: "" });

      // Retry the original payment command
      if (pendingPaymentCommandRef.current) {
        setTimeout(() => {
          handleVoiceCommand(pendingPaymentCommandRef.current!);
          pendingPaymentCommandRef.current = null;
        }, 2000); // Give user time to see the browser
      }
    } catch (err: any) {
      setError(err.message || "Failed to create beneficiary");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBeneficiary = () => {
    setNeedsBeneficiaryDetails(null);
    setBeneficiaryFormData({ upiId: "", accountNumber: "", ifsc: "" });
    pendingPaymentCommandRef.current = null;
    setAiResponse("Beneficiary creation cancelled.");
  };

  const startListeningForBeneficiary = () => {
    if (recognitionRef.current) {
      setListeningForBeneficiary(true);
      listeningForBeneficiaryRef.current = true;
      setTranscript("");
      finalTranscriptRef.current = "";
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Error starting recognition:", err);
        setListeningForBeneficiary(false);
        listeningForBeneficiaryRef.current = false;
      }
    }
  };

  const handleBeneficiaryVoiceInput = (input: string) => {
    const lowerInput = input.toLowerCase();
    
    // Try to extract UPI ID (format: something@upi or something@paytm, etc.)
    const upiMatch = input.match(/([a-z0-9._-]+@(?:upi|paytm|gpay|phonepe|ybl|axl|okaxis|okhdfcbank|okicici|oksbi|paytm|ybl|axl))/i);
    if (upiMatch) {
      setBeneficiaryFormData({ ...beneficiaryFormData, upiId: upiMatch[1] });
      setAiResponse(`Got it! UPI ID: ${upiMatch[1]}`);
      return;
    }

    // Try to extract account number (long number)
    const accountMatch = input.match(/\b(\d{9,18})\b/);
    if (accountMatch && accountMatch[1].length >= 9) {
      if (!beneficiaryFormData.accountNumber) {
        setBeneficiaryFormData({ ...beneficiaryFormData, accountNumber: accountMatch[1] });
        setAiResponse(`Got account number: ${accountMatch[1]}. Please provide IFSC code.`);
        return;
      }
    }

    // Try to extract IFSC (format: 4 letters + 0 + 6 alphanumeric)
    const ifscMatch = input.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
    if (ifscMatch) {
      setBeneficiaryFormData({ ...beneficiaryFormData, ifsc: ifscMatch[1].toUpperCase() });
      setAiResponse(`Got IFSC code: ${ifscMatch[1].toUpperCase()}`);
      return;
    }

    // If we can't parse, show the input and ask user to clarify
    setAiResponse(`I heard: "${input}". Please provide either a UPI ID (like name@upi) or account number and IFSC code.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <h1 className="text-4xl font-bold text-gray-900">VoxPe AI</h1>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            )}
          </div>
          <p className="text-lg text-gray-600">Your Voice-First, Safety-First Banking Assistant</p>
          {isAuthenticated && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 max-w-2xl mx-auto">
              <p className="font-medium">✅ Authorized - You can now use voice commands</p>
              {oauthScopes && (
                <p className="text-xs mt-1 text-green-700">
                  Permissions: {oauthScopes.split(" ").join(", ")}
                </p>
              )}
            </div>
          )}
          {!isAuthenticated && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 max-w-2xl mx-auto">
              <p className="font-medium mb-1">💡 Getting Started:</p>
              <p>1. Login with your banking credentials below</p>
              <p>2. Make sure you've added beneficiaries at <a href="http://localhost:3002/beneficiaries" target="_blank" className="underline">Banking App</a></p>
              <p>3. Use Chrome or Edge for best voice recognition</p>
              <p>4. Try: "Pay 500 rupees to Rohan via UPI"</p>
            </div>
          )}
        </div>

        {showLogin && !isAuthenticated && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center space-x-3 mb-6">
              <Lock className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Connect Banking Account</h2>
            </div>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                <strong>🔒 Secure OAuth2 Authorization</strong>
              </p>
              <p className="text-sm text-blue-700 mb-2">
                Your banking credentials are never shared with the AI agent. You'll authorize access through the banking app with scoped permissions.
              </p>
              <ul className="text-xs text-blue-600 list-disc list-inside space-y-1">
                <li>You control what the AI can access</li>
                <li>You can revoke access anytime</li>
                <li>No passwords stored by the AI agent</li>
                <li>Time-limited access tokens</li>
              </ul>
            </div>
            <button
              onClick={handleAuthorize}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Lock className="w-5 h-5" />
              <span>Authorize with Banking App</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">
              Don't have an account? <a href="http://localhost:3002/register" target="_blank" className="underline">Register here</a>
            </p>
          </div>
        )}

        {isAuthenticated && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex flex-col items-center space-y-6">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={loading || !isAuthenticated}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? (
                  <MicOff className="w-12 h-12" />
                ) : (
                  <Mic className="w-12 h-12" />
                )}
              </button>

              <p className="text-sm text-gray-500">
                {isListening ? "Listening..." : "Click to speak"}
              </p>
            </div>

          {transcript && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">You said:</p>
              <p className="text-gray-900">{transcript}</p>
            </div>
          )}

          {aiResponse && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-700 mb-2">AI Response:</p>
              <p className="text-blue-900">{aiResponse}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

            {loading && (
              <div className="mt-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Processing...</p>
              </div>
            )}
          </div>
        )}

        {needsBeneficiaryDetails && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Beneficiary</h2>
            <p className="text-gray-600 mb-6">
              I need to add <span className="font-semibold">{needsBeneficiaryDetails.beneficiaryName}</span> to your beneficiaries to process the payment of ₹{needsBeneficiaryDetails.amount}.
            </p>

            <div className="space-y-4">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  💡 You can speak the details or type them below
                </p>
                <button
                  onClick={startListeningForBeneficiary}
                  disabled={listeningForBeneficiary || loading}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {listeningForBeneficiary ? "Listening..." : "Click to speak beneficiary details"}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UPI ID (e.g., name@upi)
                </label>
                <input
                  type="text"
                  value={beneficiaryFormData.upiId}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, upiId: e.target.value })}
                  placeholder="rohan@paytm or leave empty"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-center text-gray-500 text-sm">OR</div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={beneficiaryFormData.accountNumber}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, accountNumber: e.target.value })}
                  placeholder="Account number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={beneficiaryFormData.ifsc}
                  onChange={(e) => setBeneficiaryFormData({ ...beneficiaryFormData, ifsc: e.target.value.toUpperCase() })}
                  placeholder="IFSC code"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCreateBeneficiary}
                  disabled={loading || (!beneficiaryFormData.upiId && (!beneficiaryFormData.accountNumber || !beneficiaryFormData.ifsc))}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Adding..." : "Add & Continue Payment"}
                </button>
                <button
                  onClick={handleCancelBeneficiary}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {preview && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Preview</h2>

            {!preview.rulesResult.allowed ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700 font-medium mb-2">Payment Blocked</p>
                <ul className="list-disc list-inside text-red-600">
                  {preview.rulesResult.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="font-medium">{preview.beneficiaryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Method:</span>
                    <span className="font-medium">{preview.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">₹{preview.requestedAmount}</span>
                  </div>
                  {preview.charges > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Charges:</span>
                      <span className="font-medium">₹{preview.charges}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-gray-700 font-medium">Total Debit:</span>
                    <span className="font-bold text-lg">₹{preview.finalDebitAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">From Account:</span>
                    <span className="font-medium">{preview.accountNumber}</span>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleConfirmPayment}
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirm Payment</span>
                  </button>
                  <button
                    onClick={handleCancelPayment}
                    disabled={loading}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        </div>
    </div>
  );
}
