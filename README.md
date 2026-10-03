# GoHash — Blockchain-Based Digital Notary System

A decentralized notary platform where users can hash, timestamp, and certify documents on the blockchain, ensuring tamper-proof proof-of-existence.

---

## 🧱 Tech Stack

| Layer      | Technology                           |
|------------|--------------------------------------|
| Frontend   | React + TypeScript + Vite            |
| Backend    | Node.js + Express + TypeScript       |
| Database   | MongoDB (via Mongoose)               |
| Blockchain | Hardhat + Solidity (local / testnet) |

---

## 📂 Project Structure

```
GoHash/
├── frontend/          # React TypeScript app (Vite)
├── backend/           # Node.js Express API
├── blockchain/        # Hardhat smart contracts
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- MongoDB (local or Atlas URI)
- MetaMask browser extension (for frontend wallet)

---

### 1. Blockchain (Hardhat)

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat node          # Start local blockchain on port 8545
```

Deploy contracts (in a second terminal):
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

---

### 2. Backend (Express API)

```bash
cd backend
npm install
cp .env.example .env      # Fill in your MongoDB URI & contract address
npm run dev               # Starts on http://localhost:5000
```

---

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env      # Fill in the backend API URL
npm run dev               # Starts on http://localhost:5173
```

---

## 🔐 Core Features (Planned)

- [ ] Upload & SHA-256 hash a document client-side
- [ ] Notarize hash on-chain with timestamp
- [ ] Verify any document against the blockchain record
- [ ] User authentication (JWT)
- [ ] Certificate PDF generation
- [ ] Multi-chain support

---

## 📜 License

MIT
