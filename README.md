# VoxPe AI - Voice-First Banking Assistant

A comprehensive, production-ready voice-controlled banking system where an AI assistant can interact with a banking application through browser automation, while maintaining strict security and safety protocols. The system demonstrates how AI can safely handle financial operations with explicit user consent and complete transparency.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Features & Security](#core-features--security)
  - [Voice Biometrics](#voice-biometrics)
  - [Liveness Detection](#liveness-detection)
  - [Multi-Layer Security](#multi-layer-security)
- [Browser Automation Logic](#browser-automation-logic)
- [Setup & Installation](#setup--installation)
- [Usage Guide](#usage-guide)
- [Development](#development)

---

## Overview

VoxPe AI is a sophisticated banking assistant that allows users to perform banking operations using natural voice commands. The system consists of three main components:

1. **AI Agent App** - A voice-first interface that processes user commands using AI.
2. **Banking App (Dummy Bank)** - A realistic banking web application with full banking features.
3. **Browser Automation Worker** - A Playwright-based service that automates browser interactions.

### Key Features

- 🎤 **Voice-First Interface** - Natural language voice commands for banking.
- 🛡️ **Voice Biometrics** - Secure enrollment and verification using unique vocal signatures.
- 🧬 **Liveness Detection** - Advanced spectral analysis to prevent replay attacks.
- 🔐 **PIN Security** - Multi-layer protection with account-linked PINs.
- 🤖 **AI-Powered** - Uses Google Gemini AI for intent parsing and command understanding.
- 🌐 **Browser Automation** - Automates banking operations through a visible browser window for transparency.
- ⚡ **Two-Phase Payment Flow** - Preview → Confirm → Execute with explicit consent.
- 💡 **Bill Payments** - Pay electricity bills, mobile recharges, and more via voice.

---

## System Architecture

```mermaid
graph TD
    subgraph User_Interface ["User (Browser)"]
        User([Voice Commands via Web])
    end

    subgraph AI_Agent_App ["AI Agent App (Port 3000)"]
        direction TB
        subgraph FE ["Frontend"]
            VoiceRec[Voice Recognition UI]
            OAuthFlow[OAuth2 Flow]
            PreviewUI[Payment Preview UI]
        end
        subgraph BE ["Backend API"]
            ProcessCmd["/api/ai/process-command"]
            ConfirmPay["/api/ai/confirm-payment"]
            CreateBen["/api/ai/create-beneficiary"]
        end
        subgraph AI_Svc ["AI Services"]
            Gemini[Google Gemini AI]
            Security[Security & Fraud Detection]
            RateLimit[Rate Limiting]
        end
    end

    subgraph Banking_App ["Banking App (Port 3002)"]
        direction TB
        subgraph Bank_UI ["Banking UI"]
            Dashboard[Dashboard]
            Transfer[Transfer Money]
            History[Statements]
        end
        subgraph Bank_API ["Banking API"]
            AuthAPI["/api/auth/*"]
            PayAPI["/api/payments/*"]
            AccAPI["/api/accounts"]
        end
    end

    subgraph Automation_Worker ["Browser Automation Worker (Port 3001)"]
        Playwright[Playwright / Visible Browser]
    end

    User -- "Capture Audio" --> FE
    FE -- "Command & Audio" --> BE
    BE -- "Analyze Intent" --> AI_Svc
    BE -- "HTTP Auth/API" --> Bank_API
    BE -- "Trigger Automation" --> Playwright
    Playwright -- "Automate UI" --> Bank_UI
    Bank_API -- "Data" --> BankDB[(Banking DB)]
    BE -- "Log Actions" --> AIDB[(AI Agent DB)]
```

---

## Core Features & Security

### Voice Biometrics

VoxPe implements advanced biometric security to reduce friction while maintaining high safety standards.

- **Enrollment**: Users read a mandatory security sentence to generate a unique vocal embedding.
- **Verification**: Uses **Cosine Similarity** (Threshold: `0.85`) to compare live commands against the stored profile.
- **Frictionless Flow**: If the voice matches, the security PIN is automatically skipped for the current transaction.
- **Rotation Policy**: Voice signatures automatically expire every **90 days**, requiring re-enrollment to maintain accuracy.
- **Re-enrollment Security**: Any attempt to update or re-enroll a voice profile requires verification via the **4-digit Security PIN**.

### Liveness Detection

To prevent replay attacks (recordings played into the mic), the system performs real-time **Spectral Flatness** analysis.
- **Live Voice**: Dynamic frequency spectrum with high variance.
- **Recorded Voice**: Flatter, less dynamic spectrum.
- **Rejection**: Commands with a flatness score below `0.01` are instantly blocked.

### Multi-Layer Security

1. **Account-Linked PINs**: Every bank account is protected by a unique 4-digit PIN (hashed with `bcrypt`).
2. **Two-Phase Confirmation**: AI creates a preview; the user must explicitly click "Confirm" before any execution.
3. **Idempotency**: All payment executions are idempotent, preventing accidental double-deductions.
4. **Fraud Detection**: Amount thresholds (₹50,000 limit) and frequency analysis block suspicious activity.
5. **Audit Logging**: Every AI action is logged with a unique Trace ID for full accountability.

---

## Browser Automation Logic

VoxPe AI uses Playwright to perform banking operations. This ensures that every action is visible and verifiable by the user.

```mermaid
graph TD
    S1["Step 1: Initialize Browser Context<br/>- Creates Playwright context<br/>- Sets viewport: 1280x720"]
    S2["Step 2: Authenticate<br/>- Sets OAuth token as cookie<br/>- Navigates to /transfer"]
    S3["Step 3: Wait for Page Load<br/>- Waits for form visibility<br/>- Populates beneficiaries"]
    S4["Step 4: Select Beneficiary<br/>- Matches recipient name<br/>- Selects matching option"]
    S5["Step 5: Select Payment Method<br/>- Clicks button with text 'UPI'"]
    S6["Step 6: Enter Amount<br/>- Fills with requested amount<br/>- Waits for validation"]
    S7["Step 7: Submit Payment<br/>- Clicks submit<br/>- Waits for confirmation"]
    S8["Step 8: Extract Result<br/>- Searches page for reference ID"]
    S9["Step 9: User Visibility<br/>- Keeps browser open for 10 seconds"]
    S10["Step 10: Return Result<br/>- Returns success and reference ID"]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9 --> S10
```

---

## Setup & Installation

### Step 1: Install Dependencies

```bash
# Install all project dependencies
npm install

# Install Playwright browsers for the worker
npx playwright install chromium
```

### Step 2: Database Setup

The project uses two separate PostgreSQL databases (e.g., Neon).

```bash
# Banking database
cd packages/db-banking
export DATABASE_URL="your-banking-db-url"
npm run db:generate
npm run db:push

# AI agent database
cd ../db-ai
export DATABASE_URL="your-ai-db-url"
npm run db:generate
npm run db:push
```

### Step 3: Run Services

```bash
# Terminal 1: Banking App (Port 3002)
npm run dev:bank

# Terminal 2: AI Agent App (Port 3000)
npm run dev:ai

# Terminal 3: Browser Automation Worker (Port 3001)
npm run dev:worker
```

---

## Usage Guide

1. **Register**: Go to `http://localhost:3002/register` and create an account.
2. **Add Beneficiary**: Login to the bank and add at least one recipient (UPI or Account).
3. **Authorize**: Go to `http://localhost:3000` and click **"Securely Connect Banking App"**.
4. **Speak**: Click the mic and say: *"Pay 500 rupees to Rohan via UPI"* or *"What's my balance?"*.
5. **Verify**: Review the AI's preview and click **"Confirm Payment"** to watch the automation execute.

---

## Development

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Express.js
- **Automation**: Playwright (Chromium)
- **AI**: Google Gemini AI (Gemini 2.5 Flash)
- **Voice**: WebKit Speech Recognition API

**Built with ❤️ for safe, transparent AI-powered banking.**
