"use client";
import { MotionConfig } from "framer-motion";
import { WalletProvider } from "@/components/Wallet";
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user"><WalletProvider>{children}</WalletProvider></MotionConfig>;
}
