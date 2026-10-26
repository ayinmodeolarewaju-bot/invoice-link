import "./globals.css";
import "@near-wallet-selector/modal-ui/styles.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
export const metadata: Metadata = { title: "Invoice Link: get paid in stablecoins from any chain", description: "Invoices paid from any chain via NEAR Intents (1-Click Swap API)." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen font-sans"><Providers>{children}</Providers></body></html>;
}
