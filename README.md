# PayMaster - Agentic Finance 

**An AI-powered, intent-based payment routing platform that simplifies Web3 payment operations through intelligent intent processing, route optimization, risk assessment, approval workflows, and blockchain-based execution.**

---

## 📋 Project Overview

**PayMaster** is a full-stack Web3 payment platform designed to simplify the complexity of blockchain transactions.

Traditional blockchain payment systems require users to understand technical details such as wallets, networks, tokens, gas fees, transaction routes, and smart contracts.

Our system introduces an **intent-based approach** where users can describe what they want to accomplish rather than manually specifying every technical transaction parameter.

For example:

> **"Pay Alice RM2,500 for invoice INV-1024 by Friday."**

The platform converts the payment request into a structured intent, evaluates possible payment routes, performs risk assessment, obtains approval, and prepares the transaction for blockchain execution.

The project is built as a monorepo containing a **Next.js frontend, Express backend, Supabase database layer, shared TypeScript packages, and Solidity smart contracts**.

---

# 🎯 Platform Capabilities

### 🤖 AI-Powered Intent Processing

Transform natural-language payment requests into structured payment intents containing:

* Payment action
* Recipient
* Amount
* Currency
* Target blockchain
* Due date
* Confidence score
* Missing information
* Original user input

### 🧠 Intelligent Payment Planning

Generate and evaluate payment plans based on:

* Transaction cost
* Estimated gas
* Execution time
* Number of transactions
* Potential savings
* Risk score
* Route recommendation

### 🛣️ Payment Route Optimization

The system supports multiple candidate payment routes and compares their characteristics before selecting a recommended route.

Example routes represented in the project include:

* Polygon Native USDC Direct Transfer
* Ethereum Mainnet Bridge & Pay

### 🛡️ Risk Assessment

Payment plans can be evaluated across multiple security and operational factors:

* Balance check
* Recipient verification
* Slippage check
* Network verification
* Smart-contract verification
* Overall risk
* Risk warnings

### ✅ Approval Workflow

Payment operations can require explicit approval before execution.

Approval records contain information such as:

* Approver
* Approval status
* Approval timestamp
* Rejection reason

### ⛓️ Blockchain Execution

The smart-contract layer provides controlled execution through:

* `IntentRouter.sol`
* `SmartWallet.sol`

The contracts implement authorization, transaction validation, nonce-based replay protection, and reentrancy protection.

---

# 🔄 Payment Workflow

```text
                    USER
                      │
                      │ Natural Language Intent
                      ▼
             ┌──────────────────┐
             │ Payment Request  │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Intent Processing│
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Payment Planning │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Route Evaluation │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Risk Assessment  │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Approval         │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Transaction      │
             │ Execution        │
             └────────┬─────────┘
                      │
                      ▼
                BLOCKCHAIN
                      │
                      ▼
             ┌──────────────────┐
             │ Audit / Activity │
             └──────────────────┘
```

---

# 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                         USER                             │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                      │
│                                                          │
│ Dashboard │ Payments │ Operations │ Activity │ Settings  │
│                                                          │
│ Chat │ Planner │ Risk │ Wallet │ Web3 │ Execution        │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    EXPRESS BACKEND                       │
│                                                          │
│                    REST API / Services                   │
└───────────────┬──────────────────────────┬───────────────┘
                │                          │
                ▼                          ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│        SUPABASE          │    │       BLOCKCHAIN         │
│                          │    │                          │
│ PostgreSQL               │    │ IntentRouter             │
│ Authentication           │    │ SmartWallet              │
│ Row Level Security       │    │                          │
│ Payment Data             │    │ Transaction Execution    │
└──────────────────────────┘    └──────────────────────────┘
```

---

# 🔐 Smart Contract Architecture

## IntentRouter

`IntentRouter.sol` acts as the routing and execution entry point for validated intent execution.

It supports:

* Authorized solver execution
* Batch execution
* Transaction step validation
* Execution events
* Owner-controlled solver authorization

Each execution step contains:

```solidity
struct ExecutionStep {
    address targetContract;
    bytes callData;
    uint256 value;
}
```

The router executes the provided steps sequentially and reverts if an execution step fails.

---

## SmartWallet

`SmartWallet.sol` provides controlled transaction execution.

### Authorization

Only authorized users or executors can initiate transactions.

### Nonce Protection

A monotonically increasing nonce prevents transaction replay.

### Input Validation

The contract validates:

* Transaction targets
* Transaction values
* Transaction batches
* Nonces
* Required addresses

### Reentrancy Protection

Mutative operations are protected against reentrancy.

### Batch Execution

Multiple transactions can be executed as a controlled batch.

---

# 🗄️ Database Architecture

The Supabase database represents the complete payment-operation lifecycle.

```text
Business Profile
       │
       ▼
Treasury Wallet
       │
       ▼
Payment Request
       │
       ▼
AI Parsed Intent
       │
       ▼
Payment Plan
       │
       ├───────────────┐
       ▼               ▼
Route Options    Risk Assessment
       │               │
       └───────┬───────┘
               ▼
           Approval
               │
               ▼
          Transaction
               │
               ▼
           Audit Log
```

The repository contains migrations for:

```text
supabase/migrations/

├── 20260101000000_init_schema.sql
├── 20260201000000_ibap_schema.sql
├── 20260809000000_ai_payment_operations.sql
└── 20260810000000_phase10_execution.sql
```

The repository also contains demonstration data in:

```text
supabase/seed.sql
```

---

# 📁 Project Structure

```text
NTU-v1/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── supabase.ts
│   │   ├── routes/
│   │   │   └── health.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── contracts/
│   ├── abis/
│   ├── contracts/
│   │   ├── mocks/
│   │   ├── IntentRouter.sol
│   │   └── SmartWallet.sol
│   ├── deployments/
│   ├── scripts/
│   │   ├── deploy.ts
│   │   ├── deploySmartWallet.ts
│   │   └── exportAbi.ts
│   ├── test/
│   │   └── SmartWallet.test.ts
│   ├── hardhat.config.ts
│   └── package.json
│
├── frontend/
│   ├── comps/
│   ├── hooks/
│   ├── lib/
│   ├── scripts/
│   ├── src/
│   │   ├── app/
│   │   │   ├── activity/
│   │   │   ├── dashboard/
│   │   │   ├── demo/
│   │   │   ├── operations/
│   │   │   ├── payments/
│   │   │   └── settings/
│   │   ├── components/
│   │   └── lib/
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── docs/
│
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

# ⚡ Quick Start

## 1. Clone the Repository

```bash
git clone https://github.com/MingEn-888/NTU-v1.git
cd NTU-v1
```

## 2. Install Dependencies

```bash
npm install
```

The repository uses npm workspaces for:

* Frontend
* Backend
* Contracts
* Shared package

## 3. Configure Environment Variables

Copy the example configuration:

```bash
cp .env.example .env
```

Configure the required values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

> ⚠️ Never commit your real `.env` file or expose your Supabase service-role key.

## 4. Start the Application

Run the frontend, backend, and shared package:

```bash
npm run dev
```

---

# 🖥️ Frontend

The frontend is built with **Next.js 14 and React 18**.

### Main Pages

```text
/dashboard
/payments
/operations
/activity
/settings
/demo
```

### Frontend Development

```bash
npm run dev:frontend
```

Or:

```bash
cd frontend
npm run dev
```

### Production Build

```bash
cd frontend
npm run build
```

---

# ⚙️ Backend

The backend uses:

* Node.js
* Express
* TypeScript
* Supabase

### Start Backend

```bash
npm run dev:backend
```

Or:

```bash
cd backend
npm run dev
```

### Health Check

```http
GET /api/v1/health
```

Example response:

```json
{
  "success": true,
  "data": {
    "status": "HEALTHY",
    "service": "intent-payment-router-backend"
  }
}
```

---

# ⛓️ Smart Contract Development

The contract layer uses:

* Solidity `0.8.24`
* Hardhat
* ethers.js
* TypeScript

### Compile Contracts

```bash
npm run compile:contracts
```

### Start Local Blockchain

```bash
npm run dev:contracts
```

### Deploy Contracts

```bash
cd contracts
npm run deploy:local
```

### Deploy SmartWallet

```bash
cd contracts
npm run deploy:wallet:local
```

### Run Contract Tests

```bash
cd contracts
npm test
```

### Export ABIs

```bash
cd contracts
npm run abi:export
```

---

# 🧪 Testing

Run the project's test suites:

```bash
npm test
```

For smart-contract testing:

```bash
cd contracts
npm test
```

The contract test suite includes tests for `SmartWallet`.

---

# 🔧 Build

Build the entire project:

```bash
npm run build
```

The build process covers:

```text
Shared Package
      ↓
Backend
      ↓
Frontend
      ↓
Smart Contracts
```

---

# 🔑 Environment Variables

| Variable                        | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-side Supabase administrative access |
| `DATABASE_URL`                  | PostgreSQL connection                      |
| `PORT`                          | Backend server port                        |
| `NODE_ENV`                      | Application environment                    |
| `ALLOWED_ORIGINS`               | Backend CORS configuration                 |

### Security

The following variable must **never** be exposed to the frontend:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Keep all secrets in environment variables and do not commit them to GitHub.

---

# 🛡️ Security Features

The platform incorporates security at both the application and blockchain layers.

### Smart Contract Security

* Authorized executor validation
* Owner-controlled authorization
* Nonce-based replay protection
* Transaction validation
* Batch validation
* Reentrancy protection
* Failed transaction handling

### Backend Security

* Environment-based configuration
* CORS configuration
* Supabase authentication integration
* User-scoped Supabase access

### Database Security

* Supabase Row Level Security
* Authenticated database access
* Separate administrative and user-scoped clients

---

# 📊 Example Payment Scenario

The included Supabase seed data demonstrates a payment scenario:

```text
Business:
TechCorp Solutions Sdn Bhd

Recipient:
Alice Tan

Amount:
RM 2,500

Currency:
USDC

Invoice:
INV-1024

Target Chain:
Polygon
```

Example user intent:

> **"Pay Alice RM2,500 for invoice INV-1024 by Friday."**

The system represents this through:

```text
Payment Request
       ↓
AI Parsed Intent
       ↓
Payment Plan
       ↓
Route Selection
       ↓
Risk Assessment
       ↓
Approval
       ↓
Transaction
       ↓
Audit Log
```

---

# 🗺️ Development Roadmap

## Phase 1 — Core Infrastructure

* [x] Monorepo architecture
* [x] Next.js frontend
* [x] Express backend
* [x] Supabase database
* [x] Smart-contract architecture
* [x] Hardhat development environment

## Phase 2 — Payment Intelligence

* [x] Payment intent data model
* [x] Payment planning model
* [x] Route options
* [x] Risk assessment model
* [x] Approval workflow
* [x] Transaction records

## Phase 3 — Blockchain Execution

* [x] IntentRouter
* [x] SmartWallet
* [x] Executor authorization
* [x] Nonce protection
* [x] Transaction validation
* [x] Batch execution

## Phase 4 — Future Development

* [ ] Expand backend payment APIs
* [ ] Live blockchain route evaluation
* [ ] Production wallet integration
* [ ] Multi-chain support
* [ ] Automated transaction monitoring
* [ ] Advanced AI agent orchestration
* [ ] Comprehensive end-to-end testing
* [ ] Smart-contract security audit

---

# 🧰 Technology Stack

## Frontend

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS
* Recharts
* Lucide React

## Backend

* Node.js
* Express
* TypeScript
* Supabase

## AI

* Google Generative AI SDK
* OpenAI SDK

## Blockchain

* Solidity 0.8.24
* Hardhat
* ethers.js
* Smart Contracts

## Database

* Supabase
* PostgreSQL
* Row Level Security

## Development

* npm Workspaces
* Git
* GitHub
* TypeScript

---

# 📈 Project Goals

The long-term goal is to make blockchain payments feel more like traditional digital payments.

Instead of asking users:

```text
Which network?
Which token?
Which contract?
Which route?
How much gas?
What transaction parameters?
```

The system aims to let users simply express:

```text
"What do I want to pay?"
```

The platform can then handle the underlying complexity through intelligent planning and controlled blockchain execution.

---

# ⚠️ Disclaimer

This project is a **hackathon prototype**.

The smart contracts and payment infrastructure have not been presented as production-grade financial infrastructure or as a substitute for a professional security audit.

Do not use real funds with experimental deployments.

---

# 👥 Team

| Name          | Role      |
| ------------- | --------- |
| KONG ZI XUAN  | Developer |
| LAU JIN XUAN  | Developer |
| GONG MING EN  | Developer |

---

# 📄 License

The smart contracts use the MIT SPDX license.

If the complete repository is intended to be open source, add an appropriate `LICENSE` file to the root of the repository.

---

# 🙏 Acknowledgements

This project was developed as a hackathon prototype exploring the intersection of:

* Artificial Intelligence
* Agentic workflows
* Blockchain
* Web3 payments
* Smart contracts
* Intent-based architecture

---

<p align="center">

**Built with 🤖 AI + ⛓️ Blockchain + 💳 Intent-Based Payments**

</p>
