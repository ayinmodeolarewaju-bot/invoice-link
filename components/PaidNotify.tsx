"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const BASE_TITLE = "Invoice Link: get paid in stablecoins from any chain";

/** Draw a violet favicon with an optional green paid badge (canvas, no asset file). */
function setFavicon(paid: boolean) {
  if (typeof document === "undefined") return;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#6E5BFF";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 14);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 34px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("IL", size / 2, size / 2 + 1);
  if (paid) {
    ctx.fillStyle = "#2BD4A4";
    ctx.beginPath();
    ctx.arc(size - 14, 14, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size - 19, 14);
    ctx.lineTo(size - 15, 18);
    ctx.lineTo(size - 9, 10);
    ctx.stroke();
  }
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = c.toDataURL("image/png");
}

/** Toast + favicon/title badge when a payment reaches SUCCESS in an open tab. */
export function PaidNotify({ show, amountLabel }: { show: boolean; amountLabel: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!show) return;
    setVisible(true);
    setFavicon(true);
    const prev = document.title;
    document.title = `✓ Paid · ${amountLabel}`;
    const t = setTimeout(() => setVisible(false), 5500);
    return () => {
      clearTimeout(t);
      document.title = prev || BASE_TITLE;
      // Keep the paid favicon while this page is open; Status remounts briefly on receipt nav.
    };
  }, [show, amountLabel]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-mint/30 bg-ink px-4 py-3 text-sm font-semibold text-white shadow-card"
          data-testid="paid-toast"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint text-ink">✓</span>
          <span>Paid · {amountLabel}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Set the default (unpaid) favicon once on the pay page. */
export function useDefaultFavicon() {
  useEffect(() => { setFavicon(false); }, []);
}
