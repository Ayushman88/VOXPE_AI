# VoxPe AI - Voice-First Banking Assistant

A comprehensive, production-ready voice-controlled banking system where an AI assistant can interact with a banking application through browser automation, while maintaining strict security and safety protocols. The system demonstrates how AI can safely handle financial operations with explicit user consent and complete transparency.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Components Deep Dive](#components-deep-dive)
  - [AI Agent App](#ai-agent-app)
  - [Banking App (Dummy Bank)](#banking-app-dummy-bank)
  - [Browser Automation Worker](#browser-automation-worker)
- [How Browser Automation Works](#how-browser-automation-works)
- [Security Architecture (SAIF Framework)](#security-architecture-saif-framework)
- [Payment Flow](#payment-flow)
- [Bill Payment Flow](#bill-payment-flow)
- [Voice Command Processing](#voice-command-processing)
- [Setup & Installation](#setup--installation)
- [Usage Guide](#usage-guide)
- [Development](#development)

---

## Overview

VoxPe AI is a sophisticated banking assistant that allows users to perform banking operations using natural voice commands. The system consists of three main components:

1. **AI Agent App** - A voice-first interface that processes user commands using AI
2. **Banking App (Dummy Bank)** - A realistic banking web application with full banking features
3. **Browser Automation Worker** - A Playwright-based service that automates browser interactions

### Key Features

- 🎤 **Voice-First Interface** - Natural language voice commands for banking operations
- 🛡️ **Voice Biometrics** - Secure enrollment and verification using unique vocal signatures
- 🧬 **Liveness Detection** - Advanced spectral analysis to prevent replay attacks
- 🔐 **PIN Security** - Multi-layer protection with account-linked PINs and secure fallback
- 🤖 **AI-Powered** - Uses Google Gemini AI for intent parsing and command understanding
- 🌐 **Browser Automation** - Automates banking operations through a visible browser window
- 🔒 **Security-First** - Implements SAIF (Safe, Accountable, Interpretable, Fair) framework
- 📊 **Audit Logging** - Complete traceability of all AI actions
- ⚡ **Two-Phase Payment Flow** - Preview → Confirm → Execute with explicit consent
- ⚙️ **Integrated Settings** - Manage bank accounts, view transactions, and update security preferences
- 💡 **Bill Payments** - Pay electricity bills, mobile recharges, and other Indian utility bills via voice commands

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (Browser)                          │
│                    Voice Commands via Web                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent App (Port 3000)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Frontend: Voice Recognition + UI                         │  │
│  │  - Speech Recognition API (WebKit)                        │  │
│  │  - OAuth2 Authorization Flow                              │  │
│  │  - Payment Preview & Confirmation UI                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Backend API Routes:                                      │  │
│  │  - /api/ai/process-command (Intent Parsing)              │  │
│  │  - /api/ai/confirm-payment (Payment Execution)           │  │
│  │  - /api/ai/create-beneficiary (Add Beneficiary)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI Services:                                             │  │
│  │  - Google Gemini AI (Intent Parsing)                      │  │
│  │  - Fallback Regex Parser                                  │  │
│  │  - Security & Fraud Detection                            │  │
│  │  - Rate Limiting                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                │ OAuth2 Token                  │ HTTP API Calls
                │                               │
                ▼                               ▼
┌──────────────────────────────────┐  ┌──────────────────────────────┐
│  Banking App (Port 3002)        │  │  Browser Automation Worker   │
│  ┌────────────────────────────┐│  │  (Port 3001)                 │
│  │  Banking UI:                ││  │  ┌────────────────────────┐ │
│  │  - Login/Register           ││  │  │  Playwright Automation   │ │
│  │  - Dashboard               ││  │  │  - Visible Browser       │ │
│  │  - Transfer Money          ││  │  │  - Form Filling          │ │
│  │  - Beneficiaries           ││  │  │  - Button Clicking       │ │
│  │  - Statements              ││  │  │  - Payment Execution     │ │
│  └────────────────────────────┘│  │  └────────────────────────┘ │
│  ┌────────────────────────────┐│  │                              │
│  │  Banking API:              ││  │                              │
│  │  - /api/auth/*             ││  │                              │
│  │  - /api/accounts           ││  │                              │
│  │  - /api/beneficiaries      ││  │                              │
│  │  - /api/payments/*         ││  │                              │
│  │  - /api/transactions       ││  │                              │
│  └────────────────────────────┘│  │                              │
└───────────────┬────────────────┘  └──────────────┬───────────────┘
                │                                 │
                │                                 │
                ▼                                 ▼
        ┌─────────────────┐            ┌──────────────────┐
        │  Banking DB     │            │  AI Agent DB     │
        │  (Neon Postgres)│            │  (Neon Postgres) │
        │  - Users         │            │  - Audit Logs   │
        │  - Accounts     │            │  - Trace IDs     │
        │  - Beneficiaries│            │                  │
        │  - Transactions │            │                  │
        │  - Previews     │            │                  │
        └─────────────────┘            └──────────────────┘
```

### Architecture Principles

1. **Separation of Concerns**: Each component has a distinct responsibility
2. **Database Isolation**: Banking and AI databases are completely separate
3. **API-Only Communication**: AI agent never directly accesses banking database
4. **OAuth2 Security**: Token-based authentication with scoped permissions
5. **Visible Automation**: Browser automation runs in visible mode for transparency

---

## Components Deep Dive

### AI Agent App

**Location**: `apps/ai-agent/`  
**Port**: 3000  
**Technology**: Next.js 14, React, TypeScript

#### Frontend Components

**Main Page (`app/page.tsx`)**

- Voice recognition interface using WebKit Speech Recognition API
- OAuth2 authorization flow with popup window
- Real-time transcript display
- Payment preview and confirmation UI
- Beneficiary creation form with voice input support

**Key Features**:

- **Speech Recognition**: Uses browser's native WebKit Speech Recognition API
  - Language: `en-IN` (Indian English)
  - Continuous mode: false (single utterance)
  - Interim results: true (shows real-time transcription)
- **OAuth2 Flow**:

  1. User clicks "Authorize with Banking App"
  2. Opens popup window to banking app's authorization page
  3. User logs in and grants permissions
  4. Banking app redirects with authorization code
  5. AI agent exchanges code for access token
  6. Token stored in localStorage with expiration

- **State Management**:
  - Authentication state (token, scopes, expiration)
  - Voice recognition state (listening, transcript)
  - Payment preview state
  - Bill payment preview state
  - Beneficiary creation state
  - **Voice Biometric State** (Enrollment step, liveness score, identity confidence)
  - **Account Settings State** (Transaction history, balance visibility toggle)

#### Security & Biometrics Deep Dive

**1. Voice Biometric Enrollment**
- Users read a mandatory security sentence: *"I authorize VoxPe to process my voice commands for secure banking."*
- System captures 2 seconds of audio data.
- Generates a **128-dimension vocal embedding** using frequency-domain analysis.
- Stores the encrypted embedding in the AI Database.

**2. Liveness Detection (Anti-Replay)**
- Uses **Spectral Flatness** analysis (Geometric Mean / Arithmetic Mean of the power spectrum).
- Detects if the audio is a recording (flat spectrum) or a live human voice (dynamic spectrum).
- Rejection threshold: `< 0.01` (configurable).

**3. Identity Verification**
- Uses **Cosine Similarity** to compare live commands against the stored profile.
- Confidence Threshold: `0.85`.
- **Frictionless Flow**: If voice matches, the 4-digit PIN is automatically skipped for the current transaction.
- **Secure Fallback**: If voice doesn't match or the command is typed, the system requires the 4-digit security PIN.

**4. Account-Linked PINs**
- Every bank account is protected by a unique 4-digit PIN.
- PINs are hashed using `bcrypt` and stored in the AI Database.
- Users can change PINs via Settings by verifying their old PIN or bank password.

#### Backend API Routes

**1. `/api/ai/process-command` (`app/api/ai/process-command/route.ts`)**

This is the core command processing endpoint that handles voice commands.

**Flow**:

1. **Authentication**: Extracts JWT token from Authorization header
2. **Intent Parsing**: Uses Google Gemini AI to parse natural language command
   - Falls back to regex parser if AI unavailable
   - Extracts: intent, amount, payee name, payment method
3. **Security Checks**:
   - Rate limiting (10 requests/min for payments, 30/min for queries)
   - Fraud detection (amount limits, frequency checks)
   - Audit logging (all actions logged with trace ID)
4. **Command Execution**:
   - **MAKE_PAYMENT**: Creates payment preview, checks beneficiaries
   - **PAY_BILL**: Creates bill payment preview, validates consumer number
   - **CHECK_BALANCE**: Fetches account balance
   - **SHOW_TRANSACTIONS**: Retrieves recent transactions
5. **Response**: Returns AI response + preview (if payment or bill payment)

**Intent Parsing with Gemini AI**:

```typescript
// System prompt instructs AI to extract:
- intent: "MAKE_PAYMENT" | "PAY_BILL" | "CHECK_BALANCE" | "SHOW_TRANSACTIONS" | "UNKNOWN"
- amount: number (e.g., 500)
- payee_name: string (e.g., "Rohan") // for MAKE_PAYMENT
- bill_type: "electricity" | "mobile" | "water" | "gas" | "broadband" | etc. // for PAY_BILL
- consumer_number: string (e.g., "1234567890") // for PAY_BILL
- payment_method: "UPI" | "IMPS" | "NEFT"
- currency: "INR"
- schedule: "NOW"
```

**Fallback Parser**:

- Regex-based pattern matching
- Handles common variations: "pay", "send", "transfer"
- Extracts amounts: "500", "Rs 500", "₹500", "500 rupees"
- Extracts payee: text after "to" keyword
- Detects payment method from keywords

**2. `/api/ai/confirm-payment` (`app/api/ai/confirm-payment/route.ts`)**

Handles payment confirmation and execution.

**Flow**:

1. **Validation**: Verifies preview exists and is valid
2. **Consent Token**: Generates JWT consent token (15min expiry)
3. **Preview Confirmation**: Confirms preview with banking API
4. **Browser Automation**:
   - Calls browser automation worker
   - Passes OAuth token for authentication
   - Executes payment in visible browser
5. **Payment Execution**: Finalizes payment with banking API
6. **Audit Logging**: Logs payment execution with trace ID

**3. `/api/ai/create-beneficiary` (`app/api/ai/create-beneficiary/route.ts`)**

Creates a new beneficiary using browser automation.

**Flow**:

1. Validates beneficiary details (UPI ID or Account+IFSC)
2. Calls browser automation worker
3. Worker logs into banking app and adds beneficiary
4. Returns success/failure status

**4. `/api/ai/pay-bill` (`app/api/ai/pay-bill/route.ts`)**

Handles bill payment confirmation and execution.

**Flow**:

1. **Validation**: Verifies bill preview exists and is valid
2. **Consent Token**: Generates JWT consent token (15min expiry)
3. **Preview Confirmation**: Confirms bill preview with banking API
4. **Browser Automation**:
   - Calls browser automation worker with PAY_BILL job
   - Passes OAuth token for authentication
   - Executes bill payment in visible browser
5. **Bill Payment Execution**: Finalizes bill payment with banking API
6. **Audit Logging**: Logs bill payment execution with trace ID

#### Libraries

**`lib/banking-api.ts`**: HTTP client for banking app API

- Methods: `login()`, `getAccounts()`, `getBeneficiaries()`, `createPaymentPreview()`, etc.
- Handles authentication token management
- Error handling and retry logic

**`lib/browser-automation.ts`**: HTTP client for browser automation worker

- Methods: `createBeneficiary()`, `executePayment()`, `payBill()`, `healthCheck()`
- Sends job requests to worker
- Handles worker communication errors

**`lib/security.ts`**: Security utilities

- `checkRateLimit()`: In-memory rate limiting
- `detectFraudulentActivity()`: Fraud detection logic
- `logAIAction()`: Audit logging to database
- `explainAIDecision()`: Generates human-readable explanations

---

### Banking App (Dummy Bank)

**Location**: `apps/banking/`  
**Port**: 3002  
**Technology**: Next.js 14, React, TypeScript, Prisma

#### Purpose

A fully functional dummy banking application that simulates a real Indian bank's internet banking portal. It provides:

- User registration and authentication
- Account management
- Beneficiary management
- Payment transfers (UPI, IMPS, NEFT)
- Bill payments (Electricity, Mobile, Water, Gas, Broadband, etc.)
- Transaction history
- OAuth2 authorization server

#### Key Pages

**1. Landing Page (`app/page.tsx`)**

- Marketing-style landing page
- Login and registration links
- Feature highlights

**2. Login (`app/(auth)/login/page.tsx`)**

- Email/password authentication
- JWT token generation
- Redirects to dashboard on success

**3. Register (`app/(auth)/register/page.tsx`)**

- User registration form
- Creates user account with initial balance
- Auto-generates account number

**4. Dashboard (`app/(protected)/dashboard/page.tsx`)**

- Account overview
- Balance display
- Quick actions

**5. Transfer (`app/(protected)/transfer/page.tsx`)**

- Payment form with:
  - Beneficiary selection dropdown
  - Payment method selection (UPI/IMPS/NEFT)
  - Amount input
  - Account selection
- Form validation
- Payment preview before submission

**6. Beneficiaries (`app/(protected)/beneficiaries/page.tsx`)**

- List of saved beneficiaries
- Add beneficiary form
- Edit/delete functionality

**7. Bill Payments (`app/(protected)/bills/page.tsx`)**

- Bill payment interface
- Bill type selection (Electricity, Mobile, Water, Gas, etc.)
- Consumer number/phone number input
- Bill amount entry or auto-fetch
- Payment confirmation
- Bill payment history

**8. Statements (`app/(protected)/statements/page.tsx`)**

- Transaction history
- Filtering and pagination

#### API Routes

**Authentication APIs** (`app/api/auth/`):

- **`/api/auth/register`**: User registration

  - Creates user in database
  - Creates default account with balance
  - Returns JWT token

- **`/api/auth/login`**: User login

  - Validates credentials
  - Returns JWT token

- **`/api/auth/authorize`**: OAuth2 authorization endpoint

  - Displays consent screen
  - Generates authorization code
  - Redirects to callback URL

- **`/api/auth/token`**: OAuth2 token exchange

  - Exchanges authorization code for access token
  - Returns token with scopes and expiration

- **`/api/auth/revoke`**: Token revocation
  - Invalidates access token

**Banking APIs** (`app/api/`):

- **`/api/accounts`**: Get user accounts

  - Returns all active accounts for authenticated user

- **`/api/beneficiaries`**: Beneficiary management

  - GET: List beneficiaries
  - POST: Create beneficiary

- **`/api/payments/preview`**: Create payment preview

  - Validates payment request
  - Calculates charges
  - Runs rules engine
  - Creates preview record (15min expiry)
  - Returns preview with rules result

- **`/api/payments/confirm-preview`**: Confirm payment preview

  - Validates consent token
  - Marks preview as confirmed

- **`/api/payments/execute-from-preview`**: Execute payment

  - Validates preview and consent token
  - Creates transaction record
  - Updates account balance
  - Returns transaction ID and reference

- **`/api/bills/preview`**: Create bill payment preview

  - Validates bill payment request
  - Validates consumer number/phone number format
  - Calculates charges (if any)
  - Creates preview record (15min expiry)
  - Returns preview with bill details

- **`/api/bills/confirm-preview`**: Confirm bill payment preview

  - Validates consent token
  - Marks bill preview as confirmed

- **`/api/bills/execute-from-preview`**: Execute bill payment

  - Validates preview and consent token
  - Creates bill payment transaction record
  - Updates account balance
  - Returns transaction ID and reference

- **`/api/bills/history`**: Get bill payment history

  - Returns past bill payments for user
  - Filterable by bill type

- **`/api/transactions`**: Get transaction history
  - Returns recent transactions for user (includes bill payments)

#### Payment Rules Engine

Located in `app/api/payments/preview/route.ts`:

```typescript
function checkPaymentRules(accountBalance, requestedAmount, method) {
  // Rules:
  // - Insufficient balance check
  // - Per-transaction limit: ₹50,000
  // - Daily limit: ₹100,000 (not fully implemented)
  // - Charge calculation:
  //   - UPI: Free
  //   - IMPS: ₹5 for amounts > ₹10,000
  //   - NEFT: ₹2.5 for amounts > ₹10,000
}
```

#### OAuth2 Implementation

**Scopes**:

- `payments`: Make payments
- `read_balance`: Read account balance
- `read_transactions`: Read transaction history
- `read_beneficiaries`: Read beneficiary list

**Token Structure**:

```typescript
{
  userId: string,
  type: "oauth_access_token",
  scopes: string[],
  clientId: "ai-agent",
  iat: number,
  exp: number
}
```

**Authorization Flow**:

1. AI agent redirects user to `/api/auth/authorize?client_id=ai-agent&scope=...`
2. User logs in (if not already)
3. User sees consent screen with requested scopes
4. User approves → redirects to callback URL with authorization code
5. AI agent exchanges code for access token at `/api/auth/token`
6. Token used for subsequent API calls

---

### Browser Automation Worker

**Location**: `workers/browser-automation/`  
**Port**: 3001  
**Technology**: Express.js, Playwright, TypeScript

#### Purpose

A standalone HTTP service that automates browser interactions with the banking app. It uses Playwright to control a visible Chrome browser, allowing users to see the AI's actions in real-time.

#### Architecture

**Server Setup** (`src/index.ts`):

- Express.js HTTP server
- Single endpoint: `POST /execute`
- Health check: `GET /health`
- Browser instance: Shared Chromium instance (reused across requests)

**Browser Configuration**:

```typescript
chromium.launch({
  headless: false, // Visible browser window
  slowMo: 300, // 300ms delay between actions (for visibility)
  channel: "chrome", // Use installed Chrome
});
```

#### Job Types

**1. CREATE_BENEFICIARY**

**Request**:

```json
{
  "type": "CREATE_BENEFICIARY",
  "name": "Rohan",
  "upiId": "rohan@paytm", // OR
  "accountNumber": "1234567890",
  "ifsc": "HDFC0001234",
  "traceId": "uuid",
  "email": "user@example.com",
  "password": "password"
}
```

**Execution Flow**:

1. Launch browser context (new tab)
2. Navigate to banking app login page
3. Fill email and password fields
4. Click submit button
5. Wait for dashboard (URL change)
6. Navigate to beneficiaries page
7. Click "Add Beneficiary" button
8. Fill beneficiary form:
   - Name field
   - UPI ID OR Account Number + IFSC
9. Submit form
10. Wait for success confirmation
11. Keep browser open for 3 seconds (user visibility)
12. Close browser context
13. Return success/failure

**Error Handling**:

- Login failures
- Form validation errors
- Network timeouts
- Element not found errors

**2. EXECUTE_PAYMENT**

**Request**:

```json
{
  "type": "EXECUTE_PAYMENT",
  "beneficiaryName": "Rohan",
  "amount": 500,
  "paymentMethod": "UPI",
  "traceId": "uuid",
  "oauthToken": "jwt-token" // OR email + password
}
```

**Execution Flow**:

**Option A: OAuth Token Authentication** (Preferred):

1. Create browser context
2. Set OAuth token as cookie and localStorage
3. Navigate directly to transfer page (already authenticated)
4. Wait for form to load (client-side rendering)
5. Wait for beneficiaries dropdown to populate
6. Select beneficiary from dropdown
7. Select payment method (button or dropdown)
8. Enter amount in number input
9. Submit form
10. Wait for success message
11. Extract reference ID from page
12. Keep browser open for 10 seconds
13. Close context
14. Return reference ID

**Option B: Email/Password Authentication** (Fallback):

1. Login with email/password (same as CREATE_BENEFICIARY)
2. Navigate to transfer page
3. Continue with steps 4-14 above

**Key Implementation Details**:

**Element Selection**:

- Uses Playwright's flexible selectors
- Handles dynamic content loading
- Waits for elements to be visible/interactive
- Fallback selectors for robustness

**Example**:

```typescript
// Find beneficiary select by first option text
const beneficiarySelect = page
  .locator("select")
  .filter({ hasText: "Select Beneficiary" })
  .first();

// Select by matching beneficiary name
await beneficiarySelect.selectOption({
  label: /Rohan/i,
});
```

**Payment Method Selection**:

- Tries button selection first (modern UI)
- Falls back to dropdown selection (legacy UI)
- Handles both patterns gracefully

**Reference ID Extraction**:

- Searches page content for pattern: `BNK\d+`
- Falls back to generated ID if not found
- Returns reference for transaction tracking

**3. PAY_BILL**

**Request**:

```json
{
  "type": "PAY_BILL",
  "billType": "electricity",
  "amount": 2500,
  "consumerNumber": "1234567890",
  "phoneNumber": null,
  "traceId": "uuid",
  "oauthToken": "jwt-token"
}
```

**Execution Flow**:

1. Create browser context
2. Authenticate with OAuth token (or email/password)
3. Navigate to bill payment page
4. Select bill type from dropdown/buttons:
   - Electricity
   - Mobile Recharge
   - Water
   - Gas
   - Broadband
   - DTH
   - Fastag
   - Property Tax
5. Enter consumer number or phone number:
   - Consumer number for bills (electricity, water, gas)
   - Phone number for mobile recharge
6. Fetch bill details (if supported by provider):
   - Auto-fetch amount
   - Display due date
   - Show bill details
7. Enter amount (if not auto-fetched)
8. Select payment account
9. Submit bill payment form
10. Wait for success message
11. Extract reference ID from page
12. Keep browser open for 10 seconds (user visibility)
13. Close context
14. Return reference ID

**Bill Type Selection**:

- Uses Playwright to find bill type selector
- Matches bill type name (case-insensitive)
- Handles different UI patterns (dropdowns, buttons, tabs)

**Form Filling**:

- Consumer number: Text input field (for electricity, water, gas bills)
- Phone number: Text input field (for mobile recharge)
- Amount: Number input field
- Account selection: Dropdown (if multiple accounts)

**Error Handling**:

- Invalid consumer number format
- Bill provider unavailable
- Amount mismatch
- Network timeouts
- Element not found errors

**Authentication with OAuth Token**:

```typescript
// Set cookie
await context.addCookies([
  {
    name: "token",
    value: oauthToken,
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  },
]);

// Set localStorage
await context.addInitScript(
  ({ token }) => {
    window.localStorage.setItem("token", token);
  },
  { token: oauthToken }
);
```

**Visibility Features**:

- Browser window remains visible throughout
- Slow motion (300ms delays) for user observation
- Extended wait times before closing (3-10 seconds)
- Console logging of all actions

---

## How Browser Automation Works

### Step-by-Step: Payment Execution

Let's trace through a complete payment execution:

**1. User Voice Command**: "Pay 500 rupees to Rohan via UPI"

**2. AI Agent Processing**:

- Parses intent: `MAKE_PAYMENT`
- Extracts: amount=500, payee="Rohan", method="UPI"
- Creates payment preview via banking API
- Returns preview to user

**3. User Confirmation**:

- User reviews preview
- Clicks "Confirm Payment"

**4. AI Agent → Browser Worker**:

```typescript
POST http://localhost:3001/execute
{
  "type": "EXECUTE_PAYMENT",
  "beneficiaryName": "Rohan",
  "amount": 500,
  "paymentMethod": "UPI",
  "traceId": "abc-123",
  "oauthToken": "eyJhbGc..."
}
```

**5. Browser Worker Execution**:

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: Initialize Browser Context                      │
│  - Creates new Playwright browser context                │
│  - Sets viewport: 1280x720                               │
│  - Configures cookies and localStorage                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: Authenticate                                   │
│  - Sets OAuth token as cookie                            │
│  - Sets OAuth token in localStorage                      │
│  - Navigates to http://localhost:3002/transfer          │
│  - Verifies not redirected to login (auth successful)    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: Wait for Page Load                             │
│  - Waits for form element to be visible                  │
│  - Waits for beneficiaries dropdown to populate         │
│  - Handles client-side rendering delays                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: Select Beneficiary                             │
│  - Finds select element with "Select Beneficiary"        │
│  - Iterates through options                              │
│  - Matches "Rohan" (case-insensitive)                   │
│  - Selects matching option                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 5: Select Payment Method                          │
│  - Finds payment method buttons                         │
│  - Clicks button with text "UPI"                        │
│  - (Fallback: Uses dropdown if buttons not found)      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 6: Enter Amount                                   │
│  - Finds number input field                             │
│  - Fills with "500"                                     │
│  - Waits for form validation                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 7: Submit Payment                                 │
│  - Finds submit button                                  │
│  - Clicks submit                                        │
│  - Waits for navigation/confirmation                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 8: Extract Result                                 │
│  - Waits for success message                            │
│  - Searches page for reference ID (BNK\d+)              │
│  - Extracts or generates reference ID                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 9: User Visibility                                │
│  - Keeps browser open for 10 seconds                    │
│  - Allows user to see completed payment                  │
│  - Closes browser context                                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 10: Return Result                                 │
│  - Returns JSON response:                                │
│    {                                                     │
│      success: true,                                     │
│      bankReferenceId: "BNK1234567890",                  │
│      status: "SUCCESS"                                  │
│    }                                                     │
└─────────────────────────────────────────────────────────┘
```

**6. AI Agent → Banking API**:

- Receives reference ID from worker
- Calls `/api/payments/execute-from-preview`
- Finalizes transaction in database
- Updates account balance

**7. User Notification**:

- AI agent displays success message
- Shows reference ID
- Updates transaction history

### Step-by-Step: Bill Payment Execution

Let's trace through a complete bill payment execution:

**1. User Voice Command**: "Pay electricity bill for 2500 rupees"

**2. AI Agent Processing**:

- Parses intent: `PAY_BILL`
- Extracts: billType="electricity", amount=2500
- Asks for consumer number if not provided
- Creates bill payment preview via banking API
- Returns preview to user

**3. User Confirmation**:

- User reviews bill preview
- Clicks "Confirm Payment"

**4. AI Agent → Browser Worker**:

```typescript
POST http://localhost:3001/execute
{
  "type": "PAY_BILL",
  "billType": "electricity",
  "amount": 2500,
  "consumerNumber": "1234567890",
  "traceId": "abc-123",
  "oauthToken": "eyJhbGc..."
}
```

**5. Browser Worker Execution**:

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: Initialize Browser Context                      │
│  - Creates new Playwright browser context                │
│  - Sets viewport: 1280x720                               │
│  - Configures cookies and localStorage                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: Authenticate                                   │
│  - Sets OAuth token as cookie                            │
│  - Sets OAuth token in localStorage                      │
│  - Navigates to http://localhost:3002/bills            │
│  - Verifies not redirected to login (auth successful)    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: Select Bill Type                               │
│  - Finds bill type selector (dropdown/buttons)          │
│  - Matches "Electricity" (case-insensitive)            │
│  - Selects matching bill type                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: Enter Consumer Number                          │
│  - Finds consumer number input field                    │
│  - Fills with "1234567890"                              │
│  - Waits for validation                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 5: Fetch Bill Details (if supported)             │
│  - Clicks "Fetch Bill" button (if available)            │
│  - Waits for bill details to load                       │
│  - Extracts amount, due date, etc.                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 6: Enter Amount                                   │
│  - Finds amount input field                             │
│  - Fills with "2500" (or uses fetched amount)          │
│  - Waits for form validation                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 7: Select Payment Account                        │
│  - Finds account selection dropdown                     │
│  - Selects default or specified account                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 8: Submit Bill Payment                            │
│  - Finds submit button                                  │
│  - Clicks submit                                        │
│  - Waits for payment confirmation                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 9: Extract Result                                │
│  - Waits for success message                            │
│  - Searches page for reference ID (BNK\d+)             │
│  - Extracts or generates reference ID                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 10: User Visibility                               │
│  - Keeps browser open for 10 seconds                    │
│  - Allows user to see completed payment                  │
│  - Closes browser context                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 11: Return Result                                 │
│  - Returns JSON response:                               │
│    {                                                     │
│      success: true,                                     │
│      bankReferenceId: "BNK1234567890",                  │
│      status: "SUCCESS"                                  │
│    }                                                     │
└─────────────────────────────────────────────────────────┘
```

**6. AI Agent → Banking API**:

- Receives reference ID from worker
- Calls `/api/bills/execute-from-preview`
- Finalizes bill payment transaction in database
- Updates account balance

**7. User Notification**:

- AI agent displays success message
- Shows reference ID
- Displays bill payment receipt
- Updates transaction history

### Why Visible Browser?

1. **Transparency**: User sees exactly what AI is doing
2. **Trust**: No "black box" automation
3. **Debugging**: Easy to identify issues
4. **Learning**: Users understand the process
5. **Safety**: User can interrupt if needed (manual intervention)

### Error Handling

**Common Errors**:

- **Worker not running**: Returns error, suggests starting worker
- **Authentication failed**: OAuth token invalid/expired
- **Element not found**: Page structure changed, timeout
- **Network error**: Banking app unreachable
- **Form validation**: Invalid data, missing fields

**Recovery Strategies**:

- Fallback to direct API execution (if browser automation fails)
- Retry with different selectors
- Clear error messages to user
- Logging for debugging

---

## Security Architecture (SAIF Framework)

VoxPe implements the **SAIF** (Safe, Accountable, Interpretable, Fair) framework for AI-powered financial systems.

### Safe

**1. Two-Phase Payment Flow**:

- **Preview Phase**: AI creates payment preview, shows to user
- **Confirmation Phase**: User explicitly confirms before execution
- **No Auto-Execution**: AI never executes payments without user consent

**2. Consent Tokens**:

- JWT tokens generated only after user confirmation
- 15-minute expiration
- Tied to specific preview ID
- Required for payment execution

**3. Rules Engine**:

- Validates all payments before execution
- Checks: balance, limits, daily limits
- Blocks invalid payments automatically

**4. Rate Limiting**:

- Payment requests: 10 per minute
- Query requests: 30 per minute
- Prevents abuse and rapid-fire attacks

**5. Fraud Detection**:

- Amount threshold checks (₹50,000 limit)
- Frequency analysis (too many payments in short time)
- Pattern detection (unusual activity)

### Accountable

**1. Audit Logging**:

- Every AI action logged to database
- Includes: userId, action, input, output, timestamp
- Trace ID for request tracking
- Immutable logs (no deletion)

**2. Trace IDs**:

- Unique identifier for each request
- Links all related operations
- Enables full request tracing

**3. Database Isolation**:

- Separate databases for banking and AI
- AI never directly accesses banking data
- All access through authenticated APIs

### Interpretable

**1. AI Decision Explanations**:

- Every AI response includes explanation
- Shows what AI understood
- Displays reasoning for decisions
- Rules result explanations

**2. Transparent Rules**:

- Payment rules visible to users
- Charge calculations explained
- Limit information displayed

**3. Visible Automation**:

- Browser automation runs visibly
- User sees every action
- No hidden operations

### Fair

**1. Equal Rules for All**:

- Same limits for all users
- No discrimination
- Transparent fee structure

**2. Access Control**:

- OAuth2 scoped permissions
- User controls what AI can access
- Revocable access

**3. Error Transparency**:

- Clear error messages
- No hidden failures
- User-friendly explanations

---

## Payment Flow

### Complete Payment Journey

```
User Voice Command
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Voice Recognition                │
│    - Browser captures audio         │
│    - Converts to text               │
│    - Sends to AI agent              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Intent Parsing                   │
│    - Gemini AI parses command       │
│    - Extracts: amount, payee, method│
│    - Falls back to regex if needed  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Security Checks                   │
│    - Rate limiting                  │
│    - Fraud detection                │
│    - Audit logging                  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Beneficiary Check                │
│    - Fetches beneficiary list      │
│    - Matches payee name            │
│    - If not found → request details │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Payment Preview Creation          │
│    - Calls banking API              │
│    - Calculates charges             │
│    - Runs rules engine              │
│    - Creates preview (15min expiry) │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. Preview Display                  │
│    - Shows amount, charges, total   │
│    - Displays rules result          │
│    - User reviews details            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. User Confirmation                │
│    - User clicks "Confirm Payment"   │
│    - Generates consent token        │
│    - Confirms preview with bank     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 8. Browser Automation                │
│    - Worker receives job             │
│    - Opens visible browser           │
│    - Authenticates with OAuth token  │
│    - Navigates to transfer page      │
│    - Fills form and submits          │
│    - Extracts reference ID           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 9. Payment Execution                │
│    - Banking API finalizes payment   │
│    - Creates transaction record      │
│    - Updates account balance         │
│    - Returns transaction ID          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 10. Success Notification             │
│     - AI displays success message   │
│     - Shows reference ID             │
│     - Updates transaction history   │
└─────────────────────────────────────┘
```

### Beneficiary Creation Flow

If beneficiary doesn't exist:

```
1. AI detects missing beneficiary
2. Requests details from user:
   - UPI ID (e.g., "rohan@paytm")
   OR
   - Account Number + IFSC Code
3. User provides details (voice or text)
4. AI calls browser automation worker
5. Worker:
   - Logs into banking app
   - Navigates to beneficiaries page
   - Clicks "Add Beneficiary"
   - Fills form with provided details
   - Submits form
6. Beneficiary created
7. AI retries original payment command
```

---

## Bill Payment Flow

### Overview

VoxPe AI supports paying various Indian utility bills through voice commands. The system can handle electricity bills, mobile recharges, water bills, gas bills, broadband bills, and more. The bill payment process follows the same secure two-phase flow as regular payments, with browser automation handling the actual bill payment on the banking app.

### Supported Bill Types

**1. Electricity Bills**:

- State electricity boards (BSES, TPDDL, MSEB, UPPCL, etc.)
- Consumer number-based payments
- Bill amount from user or fetched from provider

**2. Mobile Recharge**:

- Prepaid mobile recharge (Airtel, Jio, Vi, BSNL)
- Postpaid bill payment
- Phone number-based recharge

**3. Water Bills**:

- Municipal water supply bills
- Consumer/account number-based payments

**4. Gas Bills**:

- LPG cylinder booking
- Gas connection bill payment
- Consumer number-based

**5. Broadband/Internet Bills**:

- Internet service provider bills
- Account number-based payments

**6. Other Bills**:

- DTH Recharge (Direct-to-home TV)
- Fastag Recharge (Highway toll)
- Property Tax
- Insurance Premiums

### Bill Payment Process

```
User Voice Command
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Voice Recognition                │
│    - User says: "Pay electricity    │
│      bill for 2500 rupees"          │
│    - Browser captures audio          │
│    - Converts to text               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Intent Parsing                   │
│    - Gemini AI identifies:          │
│      intent = "PAY_BILL"            │
│      bill_type = "electricity"      │
│      amount = 2500                  │
│    - Extracts consumer number       │
│      (if provided)                  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Security Checks                   │
│    - Rate limiting                  │
│    - Fraud detection                │
│    - Amount validation              │
│    - Audit logging                  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Bill Details Collection          │
│    - If consumer number missing:     │
│      AI asks: "Please provide        │
│      consumer number"                │
│    - User provides via voice/text    │
│    - AI validates format            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Bill Preview Creation             │
│    - Calls banking API               │
│      /api/bills/preview             │
│    - Validates bill details          │
│    - Calculates charges (if any)    │
│    - Creates preview (15min expiry)  │
│    - Shows bill details:             │
│      - Bill type                    │
│      - Consumer number              │
│      - Amount                       │
│      - Due date (if available)     │
│      - Charges                      │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 6. Preview Display                  │
│    - Shows bill summary              │
│    - Displays amount and charges    │
│    - Shows consumer details          │
│    - User reviews information        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 7. User Confirmation                │
│    - User clicks "Confirm Payment"  │
│    - Generates consent token        │
│    - Confirms preview with bank     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 8. Browser Automation                │
│    - Worker receives job:            │
│      type: "PAY_BILL"               │
│      billType: "electricity"         │
│      amount: 2500                    │
│      consumerNumber: "1234567890"   │
│    - Opens visible browser           │
│    - Authenticates with OAuth token  │
│    - Navigates to bill payment page │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 9. Bill Payment Form Filling        │
│    - Selects bill type:             │
│      "Electricity"                   │
│    - Enters consumer number:        │
│      "1234567890"                    │
│    - Fetches bill details           │
│      (if supported by provider)     │
│    - Enters amount: 2500            │
│    - Selects payment account         │
│    - Submits payment form            │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 10. Payment Confirmation            │
│     - Waits for success message     │
│     - Extracts reference ID         │
│     - Keeps browser open 10 seconds │
│     - Returns reference ID          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 11. Payment Execution                │
│     - Banking API finalizes payment  │
│     - Creates transaction record    │
│     - Updates account balance        │
│     - Records bill payment details    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 12. Success Notification             │
│     - AI displays success message   │
│     - Shows reference ID             │
│     - Displays bill payment receipt  │
│     - Updates transaction history   │
└─────────────────────────────────────┘
```

### Bill Payment Details

**Consumer Number Formats**:

- **Electricity**: Usually 10-12 digits (e.g., "1234567890")
- **Mobile**: 10-digit phone number (e.g., "9876543210")
- **Water**: Varies by municipality (8-12 digits)
- **Gas**: 10-11 digits (e.g., "12345678901")

**Amount Handling**:

- User can specify amount: "Pay 2500 rupees"
- Or fetch from provider: "Pay electricity bill" (AI fetches due amount)
- System validates amount against account balance

**Bill Provider Integration**:

- Integration with bill aggregators (BillDesk, PayU, etc.)
- Real-time bill fetching
- Due date checking
- Auto-payment scheduling

### Example Voice Commands

**Electricity Bill**:

```
User: "Pay electricity bill for 2500 rupees"
AI: "I'll pay your electricity bill of ₹2500. Please provide your consumer number."

User: "Consumer number is 1234567890"
AI: "Got it! Consumer number 1234567890. Creating payment preview..."

[Preview shown]
- Bill Type: Electricity
- Consumer Number: 1234567890
- Amount: ₹2500
- Charges: ₹0
- Total: ₹2500

User: [Clicks Confirm]
AI: "Opening browser to pay your electricity bill..."
[Browser automation executes]
AI: "✅ Electricity bill paid successfully! Reference ID: BNK1234567890"
```

**Mobile Recharge**:

```
User: "Recharge my phone with 299 rupees"
AI: "I'll recharge your phone with ₹299. Please provide your phone number."

User: "9876543210"
AI: "Got it! Phone number 9876543210. Creating recharge preview..."

[Preview shown]
- Bill Type: Mobile Recharge
- Phone Number: 9876543210
- Amount: ₹299
- Charges: ₹0
- Total: ₹299

User: [Clicks Confirm]
AI: "Opening browser to recharge your phone..."
[Browser automation executes]
AI: "✅ Mobile recharge successful! Reference ID: BNK9876543210"
```

**Water Bill**:

```
User: "Pay water bill for 1200"
AI: "I'll pay your water bill of ₹1200. Please provide your consumer number."

User: "Consumer number 987654321012"
AI: "Got it! Creating payment preview..."

[Preview shown and confirmed]
AI: "✅ Water bill paid successfully!"
```

### Browser Automation for Bills

The browser automation worker handles bill payments similarly to regular payments:

**Job Type**: `PAY_BILL`

**Request Structure**:

```json
{
  "type": "PAY_BILL",
  "billType": "electricity",
  "amount": 2500,
  "consumerNumber": "1234567890",
  "phoneNumber": null,
  "traceId": "uuid",
  "oauthToken": "jwt-token"
}
```

**Execution Steps**:

1. Authenticate with OAuth token
2. Navigate to bill payment page
3. Select bill type from dropdown/buttons
4. Enter consumer number or phone number
5. Fetch bill details (if supported)
6. Enter amount (if not auto-fetched)
7. Select payment account
8. Submit payment
9. Extract reference ID
10. Return success/failure

**Bill Type Selection**:

- Uses Playwright to find bill type selector
- Matches bill type name (case-insensitive)
- Handles different UI patterns (dropdowns, buttons, tabs)

**Form Filling**:

- Consumer number: Text input field
- Phone number: Text input field (for recharge)
- Amount: Number input field
- Account selection: Dropdown (if multiple accounts)

### Security for Bill Payments

**Same Security Measures**:

- Two-phase payment flow (Preview → Confirm)
- Consent tokens required
- Rate limiting (10 bill payments per minute)
- Fraud detection
- Audit logging with trace IDs

**Bill-Specific Validations**:

- Consumer number format validation
- Phone number format validation (10 digits)
- Amount limits (same as regular payments)
- Bill type validation

### Bill Payment Features

1. **Bill Fetching**: Auto-fetch bill amount from provider
2. **Due Date Alerts**: Notify user of upcoming bill due dates
3. **Auto-Payment**: Schedule recurring bill payments
4. **Bill History**: View past bill payments
5. **Multiple Bills**: Pay multiple bills in one command
6. **Bill Reminders**: Voice reminders for due bills
7. **Provider Integration**: Direct integration with bill providers
8. **QR Code Scanning**: Scan bill QR codes for quick payment

---

## Voice Command Processing

### Supported Commands

**1. Payment Commands**:

- "Pay 500 rupees to Rohan via UPI"
- "Send ₹300 to Rohan using UPI"
- "Transfer 1000 rupees to Rohan via IMPS"
- "Pay Rs 500 to Rohan"

**Variations Handled**:

- Amount formats: "500", "Rs 500", "₹500", "500 rupees"
- Payee extraction: "to Rohan", "for Rohan"
- Method detection: "via UPI", "using IMPS", "through NEFT"

**2. Balance Queries**:

- "What's my balance?"
- "Check balance"
- "Show account balance"
- "How much money do I have?"

**3. Transaction History**:

- "Show my last 5 payments"
- "Show transactions"
- "Transaction history"
- "Recent payments"

**4. Bill Payment Commands**:

- "Pay electricity bill for 2500 rupees"
- "Pay mobile recharge of 500 rupees"
- "Pay water bill for 1200"
- "Pay gas bill ₹800"
- "Recharge my phone with 299 rupees"
- "Pay electricity bill for consumer number 1234567890"
- "Pay broadband bill for 1500"

**Bill Types Supported**:

- ⚡ **Electricity Bills** - State electricity boards (BSES, TPDDL, MSEB, etc.)
- 📱 **Mobile Recharge** - Prepaid and postpaid (Airtel, Jio, Vi, BSNL)
- 💧 **Water Bills** - Municipal water supply bills
- 🔥 **Gas Bills** - LPG cylinder bookings and gas bills
- 📶 **Broadband/Internet** - Internet service provider bills
- 📺 **DTH Recharge** - Direct-to-home TV recharge
- 🚗 **Fastag Recharge** - Highway toll payment
- 🏠 **Property Tax** - Municipal property tax payments

**Variations Handled**:

- Bill type detection: "electricity", "mobile", "recharge", "water", "gas", "broadband"
- Amount extraction: "2500", "Rs 2500", "₹2500", "2500 rupees"
- Consumer number extraction: "consumer number 1234567890", "account 9876543210"
- Phone number extraction: "for 9876543210", "mobile 9876543210"

### Intent Parsing Details

**Gemini AI Prompt Structure**:

```
System: You are a banking AI assistant. Parse the user's command and return ONLY valid JSON.

Rules:
1. If command contains "pay", "send", "transfer" → intent = "MAKE_PAYMENT"
2. Extract amount: Look for numbers like "300", "Rs 300", "₹300"
3. Extract payee: Look for names after "to" or "for"
4. Extract method: "upi", "imps", "neft" → payment_method

User command: "Pay 500 rupees to Rohan via UPI"

Expected JSON:
{
  "intent": "MAKE_PAYMENT",
  "amount": 500,
  "currency": "INR",
  "payee_name": "Rohan",
  "payment_method": "UPI",
  "schedule": "NOW"
}
```

**Fallback Parser Regex Patterns**:

```typescript
// Amount extraction
/(?:rs\.?|rupees?|₹|rupee)?\s*(\d+(?:\.\d+)?)/i

// Payee extraction
/\bto\s+([A-Za-z]+)(?:\s+(?:via|by|through|using|with)\s+(?:upi|imps|neft|bank|account))/i

// Method detection
/upi/i → "UPI"
/imps/i → "IMPS"
/neft/i → "NEFT"
```

---

## Setup & Installation

### Prerequisites

- **Node.js**: 20.x or 22.x
- **PostgreSQL**: Two separate Neon PostgreSQL databases
- **OpenAI API Key** (optional, for Gemini AI fallback)
- **Google Gemini API Key**: For intent parsing
- **Chrome Browser**: For Playwright automation

### Step 1: Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd voxpe

# Install dependencies
npm install
```

### Step 2: Database Setup

**Create Two Neon Databases**:

1. Banking database (for banking app)
2. AI agent database (for AI agent app)

**Generate Prisma Clients**:

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

### Step 3: Environment Variables

**Banking App** (`apps/banking/.env.local`):

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
JWT_SECRET="voxpe-secret-key-change-in-production"
```

**AI Agent App** (`apps/ai-agent/.env.local`):

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
OPENAI_API_KEY="your-openai-api-key"  # Optional
GEMINI_API_KEY="your-gemini-api-key"  # Required for intent parsing
JWT_SECRET="voxpe-secret-key-change-in-production"
BANK_APP_URL="http://localhost:3002"
BROWSER_AUTOMATION_URL="http://localhost:3001"
```

**Browser Automation Worker** (`workers/browser-automation/.env`):

```env
PORT=3001
BANK_APP_URL="http://localhost:3002"
```

### Step 4: Run Services

**Terminal 1 - Banking App**:

```bash
npm run dev:bank
# Runs on http://localhost:3002
```

**Terminal 2 - AI Agent App**:

```bash
   npm run dev:ai
# Runs on http://localhost:3000
```

**Terminal 3 - Browser Automation Worker**:

```bash
   npm run dev:worker
# Runs on http://localhost:3001
```

### Step 5: Initial Setup

1. **Register User**:

   - Go to http://localhost:3002/register
   - Create account with email/password
   - Note: Account created with initial balance

2. **Add Beneficiaries** (Optional):

   - Login to banking app
   - Go to Beneficiaries page
   - Add at least one beneficiary

3. **Authorize AI Agent**:

   - Go to http://localhost:3000
   - Click "Authorize with Banking App"
   - Login and grant permissions
   - Token stored in localStorage

4. **Test Voice Commands**:
   - Click microphone button
   - Try payment: "Pay 500 rupees to Rohan via UPI"
   - Try bill payment: "Pay electricity bill for 2500 rupees"
   - Review preview and confirm

---

## Usage Guide

### Getting Started

1. **Access AI Agent**: http://localhost:3000
2. **Authorize**: Click "Authorize with Banking App"
3. **Login**: Use your banking credentials
4. **Grant Permissions**: Approve requested scopes
5. **Start Speaking**: Click microphone, speak command

### Voice Commands

**Making a Payment**:

1. Click microphone
2. Say: "Pay 500 rupees to Rohan via UPI"
3. Review payment preview
4. Click "Confirm Payment"
5. Watch browser automation (visible window)
6. See success message with reference ID

**Checking Balance**:

1. Click microphone
2. Say: "What's my balance?"
3. AI responds with current balance

**Viewing Transactions**:

1. Click microphone
2. Say: "Show my last 5 payments"
3. AI lists recent transactions

**Paying Bills**:

1. Click microphone
2. Say: "Pay electricity bill for 2500 rupees"
3. AI asks for consumer number (if not provided)
4. Provide consumer number via voice or text
5. Review bill payment preview:
   - Bill type (electricity, mobile, water, etc.)
   - Consumer number/phone number
   - Amount
   - Charges (if any)
6. Click "Confirm Payment"
7. Watch browser automation:
   - Navigates to bill payment page
   - Selects bill type
   - Enters consumer number
   - Enters amount
   - Submits payment
8. See success message with reference ID

**Example Bill Payment Commands**:

- "Pay electricity bill for 2500 rupees"
- "Recharge my phone with 299 rupees"
- "Pay water bill for 1200"
- "Pay gas bill ₹800"
- "Pay electricity bill for consumer number 1234567890"

### Adding Beneficiaries via Voice

If beneficiary doesn't exist:

1. AI asks for beneficiary details
2. Provide either:
   - UPI ID: "rohan@paytm"
   - OR Account + IFSC: "Account number 1234567890, IFSC HDFC0001234"
3. AI creates beneficiary via browser automation
4. Payment proceeds automatically

### Browser Automation Visibility

When payment is confirmed:

- New Chrome window opens (visible)
- You see AI:
  - Logging into banking app
  - Navigating to transfer page
  - Selecting beneficiary
  - Entering amount
  - Submitting payment
- Window stays open for 10 seconds
- Reference ID displayed

### Troubleshooting

**Voice Recognition Not Working**:

- Use Chrome or Edge browser
- Check microphone permissions
- Ensure HTTPS or localhost (required for WebKit API)

**Payment Fails**:

- Check browser automation worker is running
- Verify beneficiary exists
- Check account balance
- Review error message

**OAuth Authorization Fails**:

- Clear browser cache
- Check banking app is running
- Verify callback URL matches

**Browser Automation Not Starting**:

- Check worker is running on port 3001
- Verify Chrome is installed
- Check worker logs for errors

---

## Development

### Project Structure

```
voxpe/
├── apps/
│   ├── ai-agent/              # AI Agent App
│   │   ├── app/
│   │   │   ├── api/          # API routes
│   │   │   │   └── ai/
│   │   │   │       ├── process-command/
│   │   │   │       ├── confirm-payment/
│   │   │   │       └── create-beneficiary/
│   │   │   ├── auth/         # OAuth callback
│   │   │   └── page.tsx      # Main UI
│   │   └── lib/              # Libraries
│   │       ├── banking-api.ts
│   │       ├── browser-automation.ts
│   │       └── security.ts
│   └── banking/              # Banking App
│       ├── app/
│       │   ├── (auth)/       # Auth pages
│       │   ├── (protected)/   # Protected pages
│       │   └── api/          # API routes
│       └── lib/              # Libraries
│           ├── auth.ts
│           └── oauth.ts
├── packages/
│   ├── db-banking/            # Banking database package
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.ts
│   └── db-ai/                # AI database package
│       ├── prisma/
│       │   └── schema.prisma
│       └── index.ts
├── workers/
│   └── browser-automation/   # Browser automation worker
│       └── src/
│           └── index.ts
└── package.json
```

### Database Schemas

**Banking Database** (`packages/db-banking/prisma/schema.prisma`):

- `User`: User accounts
- `Account`: Bank accounts
- `Beneficiary`: Payment beneficiaries
- `Transaction`: Payment transactions (includes bill payments)
- `PaymentPreview`: Payment previews (temporary)
- `BillPayment`: Bill payment records
- `BillPreview`: Bill payment previews (temporary)

**AI Database** (`packages/db-ai/prisma/schema.prisma`):

- `AIAuditLog`: AI action audit logs
  - userId, action, input, output
  - traceId, previewId, consentToken
  - timestamps

### Key Technologies

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Express.js
- **Database**: PostgreSQL (Neon), Prisma ORM
- **AI**: Google Gemini AI, Fallback regex parser
- **Automation**: Playwright (Chromium)
- **Authentication**: JWT, OAuth2
- **Voice**: WebKit Speech Recognition API

### Development Commands

```bash
# Run all services
npm run dev

# Run individual services
npm run dev:ai      # AI Agent
npm run dev:bank    # Banking App
npm run dev:worker  # Browser Worker

# Build
npm run build

# Lint
npm run lint
```

### Testing

**Manual Testing Flow**:

1. Register user in banking app
2. Add beneficiary
3. Authorize AI agent
4. Test voice commands
5. Verify browser automation
6. Check audit logs

**API Testing**:

- Use Postman/Insomnia for API testing
- Test OAuth flow manually
- Verify token expiration

---

## Security Considerations

### Production Deployment

**Before deploying to production**:

1. **Change JWT Secret**: Use strong, random secret
2. **Use HTTPS**: All communication over HTTPS
3. **Database Security**: Use connection pooling, SSL
4. **Rate Limiting**: Implement proper rate limiting (Redis)
5. **Audit Logging**: Store logs in secure, immutable storage
6. **Token Expiration**: Short-lived tokens (15min)
7. **CORS**: Configure proper CORS policies
8. **Environment Variables**: Never commit secrets
9. **Browser Automation**: Consider headless mode in production
10. **Monitoring**: Set up error tracking and monitoring

### Best Practices

- **Never log sensitive data**: Passwords, tokens, account numbers
- **Validate all inputs**: Sanitize user inputs
- **Use parameterized queries**: Prevent SQL injection
- **Implement CSRF protection**: For state-changing operations
- **Regular security audits**: Review code for vulnerabilities
- **Keep dependencies updated**: Regular security patches

---

**Built with ❤️ for safe, transparent AI-powered banking**

# VOXPE_AI
