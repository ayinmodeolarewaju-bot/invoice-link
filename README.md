# Invoice Link

[![CI](https://github.com/ayinmodeolarewaju-bot/invoice-link/actions/workflows/ci.yml/badge.svg)](https://github.com/ayinmodeolarewaju-bot/invoice-link/actions/workflows/ci.yml)

**Send a link. Get paid in stablecoins from any chain, settled through NEAR Intents.**

Track: Real-World Money (`realworld`). Built during the NEAR HACKATHON (Nov 1–14, 2026).

## Hackathon log

The prototype was started on Oct 26, 2026, before the build window opened. Everything listed below was built inside the NEAR HACKATHON window (Nov 1–14, 2026), one small commit per task.

| Date (UTC) | What changed |
|---|---|
| Nov 1 | Build window opened. Repo made public with the pre-window prototype history (invoice builder, pay flow, live status, receipt UI, demo scripts). Started this log. |
| Nov 2 | Default payout set to `purefile1686.near`. Payout account checked on NEAR mainnet (`view_account`) before quoting, with an inline "account not found on mainnet" message in the builder. Refund address validated per chain with a clear message. First Vitest unit tests (`npm test`). |
| Nov 3 | Payout autofills from the connected NEAR wallet: still editable, shows a "From wallet" badge, never overwrites a value you typed, and goes back to the default on sign-out. New "My invoices" list under the builder shows only the connected account's invoices (open or paid), via `GET /api/invoices?owner=`. More unit tests. |
| Nov 4 | Test suite: Vitest covers the payment status state machine, the invoice-to-quote amount mapping, USDT/USDT0 symbol handling and rejection of an unverified quote signature (30 tests, `npm test`). Playwright end-to-end test walks the full mock flow from builder to paid receipt (`npm run test:e2e`). Status and quote logic moved into small pure helpers (`lib/status.ts`, `lib/quote.ts`). |
| Nov 5 | Receipt PDF no longer needs Chrome: `/api/receipt/[id]/pdf` renders with `@react-pdf/renderer` (serverless-safe), same layout and proof block. Playwright stays only for e2e/shots/demo scripts. |

## Problem
Freelancers chase cross-border payments: wires are slow, and crypto clients hold the "wrong" token on the "wrong" chain. Invoice Link lets the client pay with what they have; the freelancer receives exactly the invoiced amount in USDC.

## Try it (do X, see Y)
1. **Open http://localhost:3000** → you see the invoice builder, prefilled with clearly marked example data.
2. **Click "Connect NEAR wallet"** → the NEAR Wallet Selector modal opens (MyNearWallet, Meteor); the payout account fills in.
3. **Click "Create pay link"** → the button morphs into a shareable `/pay/<id>` link.
4. **Open the pay page** → the client sees the invoice (desktop and mobile layouts).
5. **Pick a token and network** (USDT/USDC/ETH on Arbitrum, Ethereum, Solana, NEAR…) → a 1-Click `EXACT_OUTPUT` quote shows exactly what to send so the freelancer gets 450.00 USDC.
6. **Click "Get deposit address"** → you get a QR code, a deposit address and a deadline ring.
7. **Click "Simulate deposit"** (mock mode) → the status rail animates through Deposit → Processing → Settled.
8. **On SUCCESS** → you land on the receipt with a PAID stamp and a **Proof** panel: the 1-Click quote signature, the deposit tx hash and explorer links (in mock mode these are clearly labelled as simulated).
9. **Click "Download PDF"** → you get a real PDF (`/api/receipt/<id>/pdf`, rendered with `@react-pdf/renderer`) styled like the receipt.

## NEAR tech used
- **NEAR Intents via the 1-Click API**:
  - `GET /v0/tokens` lists the tokens you can pay with.
  - `POST /v0/quote` with `swapType: EXACT_OUTPUT` returns a quote and a deposit address.
  - `POST /v0/deposit/submit` reports the deposit tx hash.
  - `GET /v0/status` tracks the payment.
- **NEAR Wallet Selector** (`@near-wallet-selector/core` and `modal-ui`, MyNearWallet, Meteor) for the freelancer's NEAR account.
- **NEAR accounts** are the payout identity. The demo payout account is `purefile1686.near` (live on mainnet).
- **Quote signature verification**: each live quote's Ed25519 `signature` is checked with `verifyQuoteSignature()` from `@defuse-protocol/one-click-sdk-typescript`, and the quote is refused if the check fails. The signature is stored and shown on the receipt.
- **NEP-141 stablecoins**: payout is USDC settled through the Intents network.

## Run
```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run shots      # Playwright walk-through → shots/ + shots/08-receipt.pdf (needs the dev server running)
```

## Environment (`.env.local`, never committed)
| Var | Default | Meaning |
|---|---|---|
| `MOCK_1CLICK` | `1` | `1` simulates quotes, deposits and status; `0` calls the live 1-Click API |
| `ONECLICK_JWT` | empty | Optional partner key from partners.near-intents.org (without it, 1-Click adds a 0.25% fee) |
| `NEXT_PUBLIC_DEFAULT_PAYOUT` | `purefile1686.near` | Payout account prefilled in the builder (must exist on mainnet for live quotes) |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` | Network the wallet selector uses (use `mainnet` for a live payout account) |

## Real vs mock
| Piece | Mock (default) | Real (`MOCK_1CLICK=0`) |
|---|---|---|
| Token list | live `/v0/tokens` (falls back to a built-in list if the fetch fails) | live |
| Quote | local fake with a 0.3% fee and a random deposit address | live `/v0/quote` (mainnet assets) |
| Deposit | the "Simulate deposit" button | the client sends funds; `/v0/deposit/submit` reports the tx |
| Quote signature | placeholder `ed25519:SIMULATED-…`, labelled simulated | verified with the SDK; the quote is refused if invalid |
| Explorer links | none (tx hash shown as simulated) | chain explorer (nearblocks, arbiscan, etherscan, solscan…) and explorer.near-intents.org |
| Status | a timeline: 0s known tx, 3s processing, 8s success | live `/v0/status` polling |

## First live $1 test (optional checklist)
Live quotes use **mainnet** assets. Only do this with money you are fine losing to a mistake.
1. [ ] Have a real, existing mainnet NEAR account for the payout (e.g. `yourname.near`). 1-Click returns an error for accounts that don't exist.
2. [ ] Optional: get a partner JWT at partners.near-intents.org and put it in `.env.local` as `ONECLICK_JWT=…` (never commit it).
3. [ ] Set `MOCK_1CLICK=0` and `NEXT_PUBLIC_NEAR_NETWORK=mainnet` in `.env.local`, then run `npm run dev`.
4. [ ] Create an invoice for **1.00 USDC**, set the payout to your account on NEAR, and open the pay link.
5. [ ] Pick a token you hold (for example USDC on Arbitrum) and paste **your own** refund address on that chain.
6. [ ] Check the quote card says "Live 1-Click quote" and the amount looks right (about 1.0x).
7. [ ] Click "Get deposit address". The server verifies the quote signature first and refuses the quote if it fails.
8. [ ] From your wallet, send **exactly** the shown amount to the deposit address before the deadline. Paste the tx hash so `/v0/deposit/submit` is called.
9. [ ] Watch the status go PENDING_DEPOSIT → KNOWN_DEPOSIT_TX → PROCESSING → SUCCESS (or REFUNDED, which goes to your refund address).
10. [ ] Open the receipt: check the signature shows "verified", and that the tx link opens the right explorer. Download the PDF.
11. [ ] Confirm the 1.00 USDC arrived in your NEAR account on nearblocks.io.

## Limitations
- Real mode has been tested only up to verified **dry** quotes (no funds sent yet).
- The receipt has no on-chain anchor of its own: it links to the deposit tx and the Intents explorer.
- The PDF is generated with `@react-pdf/renderer` (no Chrome). Layout mirrors the on-screen receipt, including the proof block.
- Refund-address checks are format-only (no checksum or on-chain lookup); 1-Click still has the final say.
- The payout field autofills from the connected wallet but stays editable (on purpose, so you can be paid to another account).
- "My invoices" filters by the connected account id without a signed message, so it only returns summaries (no client email or line items).
- Storage is local SQLite (`data/invoicelink.db`). There are no user accounts.

## License
MIT. See [LICENSE](LICENSE).
