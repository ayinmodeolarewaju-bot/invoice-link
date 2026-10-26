export type LineItem = { description: string; detail?: string; amount: number };
export type Invoice = {
  id: string; number: string; fromName: string; fromTagline: string; clientName: string; clientEmail: string; clientLocation?: string;
  items: LineItem[]; currency: "USDC" | "USDT"; payoutAccount: string; payoutChain: string; ownerAccount?: string | null;
  issuedAt: string; dueAt: string; status: "open" | "paid"; createdAt: string; isExample?: boolean;
};
export type OneClickStatus = "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "PROCESSING" | "SUCCESS" | "INCOMPLETE_DEPOSIT" | "REFUNDED" | "FAILED";
export type Payment = {
  id: string; invoiceId: string; depositAddress: string; depositMemo?: string | null; originAsset: string; originSymbol: string; originChain: string;
  amountIn: string; amountInFormatted: string; amountOutFormatted: string; deadline: string; timeEstimate?: number;
  status: OneClickStatus; txHash?: string | null; mock: boolean; history: { status: OneClickStatus; at: string }[]; createdAt: string; updatedAt: string;
  raw?: unknown;
  proof?: { signature: string; timestamp: string | null; correlationId: string | null; verified: boolean | null; simulated: boolean };
};
export type Token = { assetId: string; decimals: number; blockchain: string; symbol: string; price: number; contractAddress?: string | null };
export const total = (i: Pick<Invoice, "items">) => i.items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
