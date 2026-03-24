# SplitNaira

Royalty splitting for Nigeria's creative economy, powered by Stellar and Soroban.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-7B61FF)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-blueviolet)](https://soroban.stellar.org)
[![Wave Program](https://img.shields.io/badge/Stellar-Wave%20Program-blue)](https://drips.network/wave/stellar)

## Status

SplitNaira is in active development. This repo currently contains:
- `contracts/` Soroban smart contract and tests
- `frontend/` Next.js + Tailwind scaffold
- `backend/` Express API scaffold
- `demo/` Static HTML flow prototype

## Tech Stack

- Frontend: Next.js (App Router), TailwindCSS, TypeScript
- Backend: Node.js, Express, TypeScript
- Smart contracts: Soroban (Rust)
- Blockchain: Stellar (testnet + mainnet)

## Getting Started

Prerequisites:
- Node.js >= 18
- Rust + Cargo
- Stellar CLI (optional for deploy)

1. Frontend

```bash
cd frontend
npm install
npm run dev
```

2. Backend

```bash
cd backend
npm install
npm run dev
```

3. Contracts

```bash
cd contracts
cargo build
cargo test
```

4. Environment setup

```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend
cp backend/.env.example backend/.env
```

## Project Structure

```
splitnaira/
  backend/
    src/
      index.ts
      routes/
      services/
      middleware/
  contracts/
    Cargo.toml
    lib.rs
    errors.rs
    events.rs
    tests.rs
  demo/
    frontend demo.html
  frontend/
    src/
      app/
      components/
      lib/
```

## CI

GitHub Actions runs the following checks:
- Frontend: `npm run lint`, `npm run build`
- Backend: `npm run lint`, `npm run build`
- Contracts: `cargo test`

## Backend CD

- Backend deployment workflow: `.github/workflows/backend-deploy.yml`
- Default deploy target: Render
- Deployment setup docs: [docs/backend-deploy.md](./docs/backend-deploy.md)

## Roadmap

- [x] Contract baseline
- [x] Frontend scaffold
- [x] Backend scaffold
- [ ] Wallet integration
- [ ] Split creation UI wired to Soroban
- [ ] Testnet deployment
- [ ] Earnings dashboard
- [ ] Mainnet launch

## Contributing

We welcome contributions from developers, designers, and creatives who care about fair pay in Nigeria's creative economy.

Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
