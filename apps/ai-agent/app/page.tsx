"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  CheckCircle2,
  XCircle,
  Lock,
  LogOut,
  ArrowRight,
  Settings,
  Eye,
  EyeOff,
  History,
  CreditCard,
  Key,
  AlertCircle,
} from "lucide-react";

interface BankingAccount {
  id: string;
  type: string;
  accountNumber: string;
  balance: string;
  status: string;
}

interface BankingTransaction {
  id: string;
  amount: string;
  status: string;
  method: string;
  createdAt: string;
  beneficiary: { name: string };
}

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
  const [needsBeneficiaryDetails, setNeedsBeneficiaryDetails] =
    useState<BeneficiaryDetailsRequest | null>(null);
  const [beneficiaryFormData, setBeneficiaryFormData] = useState({
    upiId: "",
    accountNumber: "",
    ifsc: "",
  });
  const [collectingBeneficiaryDetails, setCollectingBeneficiaryDetails] =
    useState(false);
  const [listeningForBeneficiary, setListeningForBeneficiary] = useState(false);
  const listeningForBeneficiaryRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const pendingPaymentCommandRef = useRef<string | null>(null);
  const voiceCapturePromiseRef = useRef<Promise<{
    embedding: number[];
    livenessScore: number;
  }> | null>(null);

  // PIN states
  const [needsPinVerification, setNeedsPinVerification] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinSetupInput, setPinSetupInput] = useState("");
  const [pinSetupConfirmInput, setPinSetupConfirmInput] = useState("");

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountDetails, setShowSettingsDetails] = useState(false);
  const [settingsPinInput, setSettingsPinInput] = useState("");
  const [accounts, setAccounts] = useState<BankingAccount[]>([]);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinChangeStep, setPinChangeStep] = useState<"verify" | "new">(
    "verify",
  );
  const [pinChangeVerifyType, setPinChangeVerifyType] = useState<
    "pin" | "password"
  >("pin");
  const [oldPinInput, setOldPinInput] = useState("");
  const [bankPasswordInput, setBankPasswordInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [newPinConfirmInput, setNewPinConfirmInput] = useState("");
  const [settingsError, setSettingsError] = useState("");

  // Voice Biometrics states
  const [hasVoiceProfile, setHasVoiceProfile] = useState(false);
  const [voiceProfileStatus, setVoiceProfileStatus] = useState<{
    isExpired: boolean;
    daysUntilExpiry: number;
    lastUpdated?: string;
  } | null>(null);
  const [voiceEnrollmentStep, setVoiceEnrollmentStep] = useState(0);
  const [needsPinForVoice, setNeedsPinForVoice] = useState(false);
  const [voiceEnrollmentPin, setVoiceEnrollmentPin] = useState("");
  const [currentVoiceEmbedding, setCurrentVoiceEmbedding] = useState<
    number[] | null
  >(null);
  const [voiceVerificationScore, setVoiceVerificationScore] = useState<
    number | null
  >(null);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState("");
  const [isVerifyingVoice, setIsVerifyingVoice] = useState(false);

  // Check for existing OAuth token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("oauthAccessToken");
    const storedScopes = localStorage.getItem("oauthScopes");
    const expiresAt = localStorage.getItem("oauthExpiresAt");

    if (storedToken && expiresAt) {
      if (Date.now() < parseInt(expiresAt)) {
        setAuthToken(storedToken);
        setOauthScopes(storedScopes || "");
        setIsAuthenticated(true);
        setShowLogin(false);
        console.log("✅ [Auth] Restored authentication from localStorage");
        checkPinSetup(storedToken);
        checkVoiceProfile(storedToken);
      } else {
        console.log("⏰ [Auth] Token expired, clearing...");
        localStorage.removeItem("oauthAccessToken");
        localStorage.removeItem("oauthRefreshToken");
        localStorage.removeItem("oauthScopes");
        localStorage.removeItem("oauthExpiresAt");
      }
    }
  }, []);

  const checkPinSetup = async (token?: string) => {
    const tokenToUse = token || authToken;
    if (!tokenToUse) return;

    try {
      const accountsRes = await fetch("/api/ai/accounts", {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData);
      }
    } catch (err) {
      console.error("Error fetching accounts during setup check:", err);
    }

    try {
      const res = await fetch("/api/pin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify({ pin: "0000", accountId: "dummy" }),
      });
      const data = await res.json();

      if (data.needsSetup) {
        setShowPinSetup(true);
        setAiResponse(
          "🔒 Security Setup Required: Please set a 4-digit PIN for your bank account. This ensures only you can authorize payments.",
        );
      } else {
        setShowPinSetup(false);
      }
    } catch (err) {
      console.error("Error checking PIN setup:", err);
    }
  };

  const checkVoiceProfile = async (token?: string) => {
    const tokenToUse = token || authToken;
    if (!tokenToUse) return;

    try {
      const res = await fetch("/api/voice/enroll", {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHasVoiceProfile(data.exists);
        if (data.exists) {
          setVoiceProfileStatus({
            isExpired: data.isExpired,
            daysUntilExpiry: data.daysUntilExpiry,
            lastUpdated: data.lastUpdated,
          });
        }
      }
    } catch (err) {
      console.error("Error checking voice profile:", err);
    }
  };

  const captureVoiceEmbedding = async (): Promise<{
    embedding: number[];
    livenessScore: number;
  }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 512; // Higher resolution for better flatness calculation
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const samples: number[][] = [];
        const flatnessScores: number[] = [];

        const interval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          samples.push(Array.from(dataArray));

          // Calculate Spectral Flatness for liveness detection
          // SF = Geometric Mean / Arithmetic Mean of the power spectrum
          let sum = 0;
          let sumLog = 0;
          let count = 0;

          for (let i = 0; i < dataArray.length; i++) {
            const magnitude = dataArray[i] / 255;
            if (magnitude > 0) {
              const power = magnitude * magnitude;
              sum += power;
              sumLog += Math.log(power);
              count++;
            }
          }

          if (count > 0) {
            const arithmeticMean = sum / count;
            const geometricMean = Math.exp(sumLog / count);
            const flatness =
              arithmeticMean === 0 ? 0 : geometricMean / arithmeticMean;
            flatnessScores.push(flatness);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          stream.getTracks().forEach((track) => track.stop());
          audioContext.close();

          // Average the samples for identity embedding
          const averaged = new Array(bufferLength).fill(0);
          samples.forEach((sample) => {
            sample.forEach((val, i) => {
              averaged[i] += val;
            });
          });

          const finalEmbedding = averaged.map((val) => val / samples.length);
          const averageLiveness =
            flatnessScores.reduce((a, b) => a + b, 0) / flatnessScores.length;

          resolve({
            embedding: finalEmbedding,
            livenessScore: averageLiveness,
          });
        }, 2000);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleVerifyVoice = async () => {
    setLoading(true);
    setSettingsError("");
    setVoiceVerificationScore(null);
    setVoiceStatusMessage("");
    try {
      setIsVerifyingVoice(true);
      setVoiceStatusMessage("Listening... Please read the sentence clearly.");

      const { embedding, livenessScore } = await captureVoiceEmbedding();

      // Check for liveness first
      const LIVENESS_THRESHOLD = 0.01;
      if (livenessScore < LIVENESS_THRESHOLD) {
        setVoiceStatusMessage("❌ Replay detected. Please speak live.");
        setSettingsError(
          "Security check failed: Audio appears to be a recording.",
        );
        return;
      }

      const res = await fetch("/api/voice/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ embedding }),
      });

      const data = await res.json();
      if (res.ok) {
        setVoiceVerificationScore(data.score);
        if (data.verified) {
          setVoiceStatusMessage(
            `✅ Voice matched! (${(data.score * 100).toFixed(1)}%)`,
          );
        } else {
          setVoiceStatusMessage(
            `❌ Identity mismatch. Confidence: ${(data.score * 100).toFixed(1)}%`,
          );
        }
      } else {
        setSettingsError(data.error || "Failed to verify voice");
      }
    } catch (err: any) {
      setSettingsError("Verification error: " + err.message);
    } finally {
      setLoading(false);
      setIsVerifyingVoice(false);
    }
  };

  const handleEnrollVoice = async (pin?: string) => {
    // If re-enrolling or profile expired, and no PIN provided yet, ask for PIN
    if (hasVoiceProfile && !pin) {
      setNeedsPinForVoice(true);
      setSettingsError("");
      setVoiceStatusMessage("");
      return;
    }

    setLoading(true);
    setSettingsError("");
    setVoiceStatusMessage("");
    setNeedsPinForVoice(false);

    try {
      setVoiceEnrollmentStep(1);
      setVoiceStatusMessage("Listening... Please read the sentence below.");

      const { embedding, livenessScore } = await captureVoiceEmbedding();

      // Check for liveness during enrollment too
      const LIVENESS_THRESHOLD = 0.01;
      if (livenessScore < LIVENESS_THRESHOLD) {
        setVoiceStatusMessage(
          "❌ Audio quality too low or recording detected.",
        );
        setSettingsError(
          "Liveness check failed. Please ensure you are speaking into a real microphone.",
        );
        setVoiceEnrollmentStep(0);
        return;
      }

      const res = await fetch("/api/voice/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ embedding, pin }),
      });

      if (res.ok) {
        setHasVoiceProfile(true);
        setVoiceEnrollmentStep(2);
        setVoiceStatusMessage("✅ Voice signature enrolled successfully!");
        setTimeout(() => {
          setVoiceEnrollmentStep(0);
          setVoiceStatusMessage("");
        }, 3000);
        // Refresh status
        checkVoiceProfile();
      } else {
        const data = await res.json();
        setSettingsError(data.error || "Failed to enroll voice");
        setVoiceEnrollmentStep(0);
      }
    } catch (err: any) {
      setSettingsError("Microphone access denied or error: " + err.message);
      setVoiceEnrollmentStep(0);
    } finally {
      setLoading(false);
      setVoiceEnrollmentPin("");
    }
  };

  const handleAuthorize = () => {
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
      );
    };

    const state = generateUUID();
    const authUrl = new URL("http://localhost:3002/api/auth/authorize");
    authUrl.searchParams.set("client_id", "ai-agent");
    authUrl.searchParams.set(
      "redirect_uri",
      "http://localhost:3000/auth/callback",
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      "payments read_balance read_transactions read_beneficiaries",
    );
    authUrl.searchParams.set("state", state);

    localStorage.setItem("oauthState", state);

    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      authUrl.toString(),
      "Authorize AI Agent",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      setError(
        "Popup blocked! Please allow popups for this site and try again.",
      );
      return;
    }

    let popupCheckInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(popupCheckInterval);
          setTimeout(() => {
            const token = localStorage.getItem("oauthAccessToken");
            if (token) {
              setAuthToken(token);
              setIsAuthenticated(true);
              setShowLogin(false);
              const scopes = localStorage.getItem("oauthScopes");
              if (scopes) setOauthScopes(scopes);
              setAiResponse(
                "✅ Successfully authorized! Checking security setup...",
              );
              checkPinSetup(token);
              checkVoiceProfile(token);
              setError("");
            }
          }, 500);
        }
      } catch (e) {}
    }, 500);
  };

  const handleLogout = () => {
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

  const fetchSettingsData = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const accountsRes = await fetch("/api/ai/accounts", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (accountsRes.ok) setAccounts(await accountsRes.json());

      const transactionsRes = await fetch("/api/ai/transactions", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (transactionsRes.ok) setTransactions(await transactionsRes.json());
    } catch (err) {
      console.error("Error fetching settings data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySettingsPin = async () => {
    if (settingsPinInput.length !== 4) return;
    setLoading(true);
    setSettingsError("");
    try {
      let currentAccounts = accounts;
      if (currentAccounts.length === 0) {
        const res = await fetch("/api/ai/accounts", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          currentAccounts = await res.json();
          setAccounts(currentAccounts);
        }
      }

      const accountId =
        currentAccounts.length > 0 ? currentAccounts[0].accountNumber : "dummy";

      const res = await fetch("/api/pin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pin: settingsPinInput, accountId }),
      });
      const data = await res.json();
      if (data.verified) {
        setShowSettingsDetails(true);
        setSettingsPinInput("");
        await fetchSettingsData();
      } else {
        setSettingsError(data.error || "Invalid PIN");
      }
    } catch (err) {
      setSettingsError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (newPinInput !== newPinConfirmInput) {
      setSettingsError("PINs do not match");
      return;
    }
    setLoading(true);
    setSettingsError("");
    try {
      const res = await fetch("/api/pin/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          pin: newPinInput,
          accountId: accounts.length > 0 ? accounts[0].accountNumber : "dummy",
          verifiedVia:
            pinChangeVerifyType === "password" ? "password" : "old_pin",
          oldPin: pinChangeVerifyType === "pin" ? oldPinInput : undefined,
        }),
      });
      if (res.ok) {
        setAiResponse("✅ PIN changed successfully!");
        setIsChangingPin(false);
        setPinChangeStep("verify");
        setNewPinInput("");
        setNewPinConfirmInput("");
        setOldPinInput("");
        setBankPasswordInput("");
        setShowSettings(false);
      } else {
        const data = await res.json();
        setSettingsError(data.error || "Failed to change PIN");
      }
    } catch (err) {
      setSettingsError("Failed to change PIN");
    } finally {
      setLoading(false);
    }
  };

  // Speech Recognition Setup
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript + " ";
          else interimTranscript += transcript;
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
            handleVoiceCommand(command);
          }
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        setError(`Speech recognition error: ${event.error}`);
      };

      recognitionRef.current = recognition;
    }
  }, [hasVoiceProfile, currentVoiceEmbedding]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript("");
    setAiResponse("");
    setPreview(null);
    setError("");
    finalTranscriptRef.current = "";
    setIsListening(true);
    setCurrentVoiceEmbedding(null); // Reset for new capture

    if (hasVoiceProfile) {
      const capturePromise = captureVoiceEmbedding();
      voiceCapturePromiseRef.current = capturePromise;

      capturePromise
        .then(({ embedding, livenessScore }) => {
          const LIVENESS_THRESHOLD = 0.01;
          if (livenessScore < LIVENESS_THRESHOLD) {
            setAiResponse(
              "❌ Security Alert: Replay attack detected. For your safety, I cannot process this command.",
            );
            recognitionRef.current?.stop();
            return;
          }
          setCurrentVoiceEmbedding(embedding);
        })
        .catch((err) => {
          console.error("Voice capture error:", err);
        });
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      setError("Failed to start voice recognition.");
      setIsListening(false);
    }
  };

  const handleVoiceCommand = async (command: string) => {
    setLoading(true);
    setError("");
    try {
      let embeddingToUse = currentVoiceEmbedding;

      // If voice profile exists but embedding isn't ready yet (user spoke fast), wait for it
      if (
        hasVoiceProfile &&
        !embeddingToUse &&
        voiceCapturePromiseRef.current
      ) {
        const result = await voiceCapturePromiseRef.current;
        embeddingToUse = result.embedding;
      }

      const res = await fetch("/api/ai/process-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ command, voiceEmbedding: embeddingToUse }),
      });

      const data = await res.json();
      if (data.voiceVerificationFailed) {
        setAiResponse(data.response);
        setError("Voice signature mismatch detected.");
        return;
      }

      if (data.voiceExpired) {
        setAiResponse(data.response);
        // Maybe open settings automatically or show a specific toast
      }

      if (!res.ok) throw new Error(data.error || "Failed to process command");

      setAiResponse(data.response);
      if (data.preview) {
        setPreview(data.preview);
        // Skip PIN if voice matched
        if (data.voiceMatched) {
          setNeedsPinVerification(false);
          setAiResponse(`✅ Voice matched! ${data.response}`);
        } else {
          setNeedsPinVerification(true);
          setAiResponse(data.response);
        }
      }

      if (data.needsBeneficiaryDetails) {
        setNeedsBeneficiaryDetails({
          beneficiaryName: data.beneficiaryName,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
        });
        pendingPaymentCommandRef.current = command;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinVerification = async () => {
    if (pinInput.length !== 4) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          pin: pinInput,
          accountId: preview?.accountNumber || "dummy",
        }),
      });
      const data = await res.json();
      if (data.verified) {
        setNeedsPinVerification(false);
        setShowPinSetup(false);
        setPinInput("");
        setAiResponse("✅ PIN verified! Payment preview is now available.");
      } else {
        setError("Invalid PIN. Please try again.");
      }
    } catch (err) {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!preview || !authToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/confirm-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ previewId: preview.previewId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setAiResponse(
        `✅ Payment successful! Reference ID: ${data.bankReferenceId}`,
      );
      setPreview(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBeneficiaryVoiceInput = (input: string) => {
    setAiResponse(
      `I heard: "${input}". Please provide UPI ID or account number.`,
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
      <div className="container mx-auto px-4 py-8 max-w-4xl relative">
        <div className="text-center mb-8">
          <div className="relative flex items-center justify-center mb-4">
            <h1 className="text-4xl font-bold text-gray-900">VoxPe AI</h1>
            {isAuthenticated && (
              <div className="absolute right-0 top-0 flex items-center space-x-3">
                <button
                  onClick={() => {
                    setSettingsError("");
                    setShowSettings(true);
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-xs font-medium">Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-100"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            )}
          </div>
          <p className="text-lg text-gray-600 mb-6">
            Your Voice-First, Safety-First Banking Assistant
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-2 mb-1">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-gray-700 uppercase">
                  Payments
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Send money via UPI, IMPS, or NEFT using just your voice.
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-2 mb-1">
                <Eye className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-gray-700 uppercase">
                  Balance
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Instantly check your account balance with voice verification.
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-2 mb-1">
                <History className="w-4 h-4 text-green-600" />
                <span className="text-xs font-bold text-gray-700 uppercase">
                  History
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Review your recent transaction history hands-free.
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-blue-100">
              <div className="flex items-center space-x-2 mb-1">
                <Mic className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-gray-700 uppercase">
                  Security
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Protected by live voice biometrics and secure 4-digit PIN.
              </p>
            </div>
          </div>
        </div>

        {showLogin && !isAuthenticated && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Connect Your Bank
              </h2>
              <p className="text-gray-600 max-w-sm mx-auto">
                VoxPe AI uses secure OAuth 2.0 to connect with your banking app.
                We never store your bank password.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Secure Data Access</p>
                  <p className="text-xs text-gray-500">
                    Read-only access to balance and transaction history.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">One-Tap Authorization</p>
                  <p className="text-xs text-gray-500">
                    Easily authorize voice-based payments with your bank.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Privacy First</p>
                  <p className="text-xs text-gray-500">
                    End-to-end encrypted communication between apps.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleAuthorize}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
            >
              <Lock className="w-5 h-5" />
              <span>Securely Connect Banking App</span>
            </button>

            <p className="text-center text-[10px] text-gray-400 mt-4 uppercase tracking-widest font-bold">
              Powered by VoxPe Secure Gateway
            </p>
          </div>
        )}

        {isAuthenticated && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex flex-col items-center space-y-6">
              <button
                onClick={
                  isListening
                    ? () => recognitionRef.current?.stop()
                    : startListening
                }
                disabled={loading}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isListening ? "bg-red-500 animate-pulse" : "bg-blue-600"} text-white shadow-lg`}
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
                <p className="text-sm font-medium text-gray-700 mb-2">
                  You said:
                </p>
                <p className="text-gray-900">{transcript}</p>
              </div>
            )}

            {aiResponse && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-700 mb-2">
                  AI Response:
                </p>
                <p className="text-blue-900 whitespace-pre-wrap">
                  {aiResponse}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p>{error}</p>
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

        {preview && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Payment Preview
            </h2>
            {!preview.rulesResult.allowed ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700 font-medium mb-2">Payment Blocked</p>
                <ul className="list-disc list-inside text-red-600">
                  {preview.rulesResult.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                {!needsPinVerification && (
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span>To:</span>
                      <span className="font-medium">
                        {preview.beneficiaryName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Method:</span>
                      <span className="font-medium">{preview.method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-medium">
                        ₹{preview.requestedAmount}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t">
                      <span className="font-medium">Total Debit:</span>
                      <span className="font-bold text-lg">
                        ₹{preview.finalDebitAmount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>From Account:</span>
                      <span className="font-medium">
                        {preview.accountNumber}
                      </span>
                    </div>
                  </div>
                )}

                {needsPinVerification ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-800 font-medium mb-2">
                        🔐 Enter Your PIN
                      </p>
                      <p className="text-blue-700 text-sm">
                        Enter your 4-digit PIN to verify this payment.
                      </p>
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) =>
                        setPinInput(e.target.value.replace(/\D/g, ""))
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-widest"
                      autoFocus
                    />
                    <button
                      onClick={handlePinVerification}
                      disabled={loading || pinInput.length !== 4}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
                    >
                      Verify PIN
                    </button>
                    <button
                      onClick={() => {
                        setNeedsPinVerification(false);
                        setPinInput("");
                        setPreview(null);
                      }}
                      className="w-full bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-4">
                    <button
                      onClick={handleConfirmPayment}
                      disabled={loading}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center space-x-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Confirm Payment</span>
                    </button>
                    <button
                      onClick={() => setPreview(null)}
                      className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showPinSetup && !preview && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">🔐 Set Up Your PIN</h2>
            <p className="text-gray-600 mb-6">
              Set a 4-digit PIN for your bank account.
            </p>
            <div className="space-y-4 max-w-xs mx-auto">
              <input
                type="password"
                maxLength={4}
                value={pinSetupInput}
                onChange={(e) =>
                  setPinSetupInput(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Enter PIN"
                className="w-full px-4 py-2 border rounded-lg text-center text-xl tracking-widest"
              />
              <input
                type="password"
                maxLength={4}
                value={pinSetupConfirmInput}
                onChange={(e) =>
                  setPinSetupConfirmInput(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Confirm PIN"
                className="w-full px-4 py-2 border rounded-lg text-center text-xl tracking-widest"
              />
              <button
                onClick={async () => {
                  if (pinSetupInput !== pinSetupConfirmInput) {
                    setError("PINs do not match");
                    return;
                  }
                  setLoading(true);
                  try {
                    const res = await fetch("/api/pin/set", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`,
                      },
                      body: JSON.stringify({
                        pin: pinSetupInput,
                        accountId:
                          accounts.length > 0
                            ? accounts[0].accountNumber
                            : "dummy",
                      }),
                    });
                    if (res.ok) {
                      setShowPinSetup(false);
                      setAiResponse("✅ PIN saved successfully!");
                    }
                  } catch (err) {
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold"
              >
                Save PIN
              </button>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center space-x-2">
                  <Settings className="w-6 h-6 text-blue-600" />
                  <span>Settings & Account</span>
                </h2>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setShowSettingsDetails(false);
                    setIsChangingPin(false);
                    setSettingsError("");
                    setVoiceStatusMessage("");
                    setVoiceEnrollmentStep(0);
                    setIsVerifyingVoice(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {settingsError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{settingsError}</p>
                  </div>
                )}

                {!showAccountDetails && !isChangingPin ? (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                      <Lock className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Secure Access Required
                      </h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Enter your 4-digit PIN to view account details.
                      </p>
                      <div className="max-w-xs mx-auto">
                        <input
                          type="password"
                          maxLength={4}
                          value={settingsPinInput}
                          onChange={(e) =>
                            setSettingsPinInput(
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-widest mb-4"
                        />
                        <button
                          onClick={handleVerifySettingsPin}
                          disabled={loading || settingsPinInput.length !== 4}
                          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg"
                        >
                          {loading ? "Verifying..." : "Verify PIN"}
                        </button>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <button
                        onClick={() => setIsChangingPin(true)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors border"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Key className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold">Change PIN</p>
                            <p className="text-xs text-gray-500">
                              Update your security PIN
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>

                    <div className="border-t pt-6">
                      <div className="bg-gray-50 rounded-xl p-6 border">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Mic className="w-5 h-5 text-blue-600" />
                            </div>
                            <h4 className="font-semibold">Voice Biometrics</h4>
                          </div>
                          <div
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              hasVoiceProfile
                                ? voiceProfileStatus?.isExpired
                                  ? "bg-red-100 text-red-700"
                                  : "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {hasVoiceProfile
                              ? voiceProfileStatus?.isExpired
                                ? "Expired"
                                : "Active"
                              : "Not Set"}
                          </div>
                        </div>
                        {hasVoiceProfile && !voiceProfileStatus?.isExpired && (
                          <p className="text-[10px] text-gray-500 mb-2">
                            Expires in {voiceProfileStatus?.daysUntilExpiry}{" "}
                            days
                          </p>
                        )}
                        <p className="text-sm text-gray-600 mb-4">
                          {voiceProfileStatus?.isExpired
                            ? "Your voice signature has expired (90-day policy). Please re-enroll to continue using voice authorization."
                            : "Secure your transactions with your unique voice signature. Read the sentence below:"}
                        </p>

                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4 italic text-sm text-blue-800 text-center font-medium">
                          "I authorize VoxPe to process my voice commands for
                          secure banking."
                        </div>

                        {voiceStatusMessage && (
                          <div
                            className={`p-2 mb-4 rounded text-center text-sm font-medium ${
                              voiceStatusMessage.includes("✅")
                                ? "bg-green-50 text-green-700"
                                : voiceStatusMessage.includes("❌")
                                  ? "bg-red-50 text-red-700"
                                  : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {voiceStatusMessage}
                          </div>
                        )}

                        {needsPinForVoice ? (
                          <div className="bg-white border rounded-lg p-4 shadow-sm mb-4">
                            <p className="text-xs font-semibold mb-2 text-gray-700 uppercase">
                              Verify PIN to Re-enroll
                            </p>
                            <input
                              type="password"
                              maxLength={4}
                              value={voiceEnrollmentPin}
                              onChange={(e) =>
                                setVoiceEnrollmentPin(
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                              className="w-full px-3 py-2 border rounded text-center text-xl tracking-widest mb-3"
                              placeholder="••••"
                              autoFocus
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() =>
                                  handleEnrollVoice(voiceEnrollmentPin)
                                }
                                disabled={voiceEnrollmentPin.length !== 4}
                                className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold"
                              >
                                Verify & Continue
                              </button>
                              <button
                                onClick={() => {
                                  setNeedsPinForVoice(false);
                                  setVoiceEnrollmentPin("");
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-600 rounded text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : voiceEnrollmentStep === 0 && !isVerifyingVoice ? (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleEnrollVoice()}
                              disabled={loading}
                              className={`w-full py-2 border rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
                                voiceProfileStatus?.isExpired
                                  ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                                  : "bg-white border-blue-600 text-blue-600 hover:bg-blue-50"
                              }`}
                            >
                              <Mic className="w-4 h-4" />
                              <span>
                                {hasVoiceProfile
                                  ? voiceProfileStatus?.isExpired
                                    ? "Re-enroll Voice (Required)"
                                    : "Re-enroll Voice"
                                  : "Enroll Voice Signature"}
                              </span>
                            </button>
                            {hasVoiceProfile && (
                              <button
                                onClick={handleVerifyVoice}
                                disabled={loading}
                                className="w-full py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-100 flex items-center justify-center space-x-2"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Test Voice Match</span>
                              </button>
                            )}
                          </div>
                        ) : voiceEnrollmentStep === 1 || isVerifyingVoice ? (
                          <div className="text-center py-4">
                            <div className="animate-pulse text-blue-600 font-medium mb-2">
                              🎤 Listening... Speak now
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                              <div className="bg-blue-600 h-1.5 rounded-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                            <p className="text-xs text-gray-500">
                              Analyzing your unique vocal signature
                            </p>
                          </div>
                        ) : (
                          <div className="text-center py-2 flex flex-col items-center justify-center space-y-2">
                            <button
                              onClick={() => {
                                setVoiceStatusMessage("");
                                setVoiceEnrollmentStep(0);
                                setIsVerifyingVoice(false);
                                setVoiceVerificationScore(null);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Reset status
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isChangingPin ? (
                  <div className="space-y-6">
                    <button
                      onClick={() => setIsChangingPin(false)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      ← Back
                    </button>
                    {pinChangeStep === "verify" ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Verify Identity
                        </h3>
                        <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
                          <button
                            onClick={() => setPinChangeVerifyType("pin")}
                            className={`flex-1 py-2 text-sm font-medium rounded-md ${pinChangeVerifyType === "pin" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                          >
                            Use Old PIN
                          </button>
                          <button
                            onClick={() => setPinChangeVerifyType("password")}
                            className={`flex-1 py-2 text-sm font-medium rounded-md ${pinChangeVerifyType === "password" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                          >
                            Use Password
                          </button>
                        </div>
                        {pinChangeVerifyType === "pin" ? (
                          <input
                            type="password"
                            maxLength={4}
                            value={oldPinInput}
                            onChange={(e) =>
                              setOldPinInput(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder="Current PIN"
                            className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest"
                          />
                        ) : (
                          <input
                            type="password"
                            value={bankPasswordInput}
                            onChange={(e) =>
                              setBankPasswordInput(e.target.value)
                            }
                            placeholder="Bank Password"
                            className="w-full px-4 py-3 border rounded-lg"
                          />
                        )}
                        <button
                          onClick={async () => {
                            setLoading(true);
                            setSettingsError("");
                            try {
                              let verified = false;
                              if (pinChangeVerifyType === "pin") {
                                const res = await fetch("/api/pin/verify", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${authToken}`,
                                  },
                                  body: JSON.stringify({
                                    pin: oldPinInput,
                                    accountId:
                                      accounts[0]?.accountNumber || "dummy",
                                  }),
                                });
                                verified = (await res.json()).verified;
                              } else {
                                const res = await fetch(
                                  "/api/ai/verify-password",
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${authToken}`,
                                    },
                                    body: JSON.stringify({
                                      password: bankPasswordInput,
                                    }),
                                  },
                                );
                                verified = (await res.json()).success;
                              }
                              if (verified) {
                                setPinChangeStep("new");
                                setSettingsError("");
                              } else
                                setSettingsError(
                                  pinChangeVerifyType === "pin"
                                    ? "Invalid PIN"
                                    : "Invalid password",
                                );
                            } catch (err) {
                              setSettingsError("Verification failed");
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg"
                        >
                          Continue
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Set New PIN</h3>
                        <input
                          type="password"
                          maxLength={4}
                          value={newPinInput}
                          onChange={(e) =>
                            setNewPinInput(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="New PIN"
                          className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest"
                        />
                        <input
                          type="password"
                          maxLength={4}
                          value={newPinConfirmInput}
                          onChange={(e) =>
                            setNewPinConfirmInput(
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          placeholder="Confirm PIN"
                          className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest"
                        />
                        <button
                          onClick={handleChangePin}
                          disabled={
                            loading ||
                            newPinInput.length !== 4 ||
                            newPinInput !== newPinConfirmInput
                          }
                          className="w-full bg-green-600 text-white font-bold py-3 rounded-lg"
                        >
                          Update PIN
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <span>Bank Accounts</span>
                      </h3>
                      <div className="space-y-3">
                        {accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-lg"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className="text-blue-100 text-xs uppercase">
                                  {acc.type} Account
                                </p>
                                <p className="font-mono text-lg">
                                  {acc.accountNumber}
                                </p>
                              </div>
                              <div className="bg-white/20 px-2 py-1 rounded text-xs">
                                {acc.status}
                              </div>
                            </div>
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-blue-100 text-xs">
                                  Available Balance
                                </p>
                                <p className="text-2xl font-bold">
                                  ₹{acc.balance}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-blue-100 text-[10px]">
                                  VoxPe Secure
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <History className="w-5 h-5 text-blue-600" />
                        <span>Recent Transactions</span>
                      </h3>
                      <div className="bg-gray-50 rounded-xl overflow-hidden border">
                        {transactions.length > 0 ? (
                          <div className="divide-y">
                            {transactions.map((tx) => (
                              <div
                                key={tx.id}
                                className="p-4 flex justify-between items-center hover:bg-gray-100"
                              >
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {tx.beneficiary.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(
                                      tx.createdAt,
                                    ).toLocaleDateString()}{" "}
                                    • {tx.method}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-gray-900">
                                    ₹{tx.amount}
                                  </p>
                                  <p
                                    className={`text-[10px] font-medium ${tx.status === "SUCCESS" ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {tx.status}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-gray-500">
                            No recent transactions.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
