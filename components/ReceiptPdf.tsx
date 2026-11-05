import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { Invoice, Payment } from "@/lib/types";
import { total } from "@/lib/types";
import { chainName, dispSym, intentsUrl, money, short, txUrl } from "./fmt";

const ink = "#0B0D12";
const paper = "#F7F5F0";
const mint = "#2BD4A4";
const signal = "#FFB547";
const violet = "#6E5BFF";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: ink, backgroundColor: "#fff", paddingTop: 22, paddingBottom: 22, paddingHorizontal: 22 },
  card: { borderWidth: 1, borderColor: "#e6e4df", borderRadius: 12, padding: 18, position: "relative" },
  paid: { position: "absolute", right: 14, top: 18, borderWidth: 2.5, borderColor: mint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, color: mint, fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
  checkWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: mint, alignItems: "center", justifyContent: "center" },
  check: { color: "#fff", fontSize: 16, fontFamily: "Helvetica-Bold" },
  lbl: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#7a7c82", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12 },
  amount: { fontSize: 26, fontFamily: "Helvetica-Bold", marginTop: 4, letterSpacing: -0.5 },
  currency: { fontSize: 11, color: "#7a7c82", fontFamily: "Helvetica" },
  parties: { fontSize: 10, color: "#7a7c82", marginTop: 2 },
  dash: { borderTopWidth: 1.5, borderTopColor: "#ddd9d0", borderStyle: "dashed", marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#eceae4", paddingVertical: 7 },
  rowK: { fontSize: 10, color: "#7a7c82" },
  rowV: { fontSize: 9, fontFamily: "Courier", textAlign: "right", maxWidth: "62%" },
  proof: { marginTop: 12, backgroundColor: paper, borderRadius: 10, padding: 12 },
  proofHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  pill: { fontSize: 8, fontFamily: "Helvetica-Bold", borderWidth: 1, borderColor: "#e6e4df", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#fff" },
  proofRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  proofK: { fontSize: 9, color: "#7a7c82" },
  proofV: { fontSize: 8, fontFamily: "Courier", textAlign: "right", maxWidth: "62%" },
  link: { fontSize: 8, fontFamily: "Courier", color: violet, textDecoration: "underline" },
  note: { fontSize: 8, color: "#8a8c92", marginTop: 8, lineHeight: 1.35 },
  foot: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  footer: { marginTop: 14, textAlign: "center", fontSize: 8, color: "#8a8c92" },
});

export function ReceiptPdf({ invoice, payment }: { invoice: Invoice; payment: Payment }) {
  const settled = payment.history.find((h) => h.status === "SUCCESS")?.at ?? payment.updatedAt;
  const when =
    new Date(settled).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos",
    }) + " WAT";
  const rows: [string, string][] = [
    ["Invoice", invoice.number],
    ["Paid with", `${payment.amountInFormatted} ${dispSym(payment.originSymbol)} · ${chainName(payment.originChain)}`],
    ["Received to", short(invoice.payoutAccount, 20, 6)],
    ["Route", "NEAR Intents (1-Click)"],
    ["Settled", when],
  ];
  const pr = payment.proof;
  const sim = payment.mock;
  const txLink = !sim && payment.txHash ? txUrl(payment.originChain, payment.txHash) : null;
  const intents = !sim ? intentsUrl(payment.depositAddress) : null;
  const signedAt = pr?.timestamp
    ? new Date(pr.timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "n/a";

  return (
    <Document title={`Receipt ${invoice.number}`} author="Invoice Link">
      {/* ~A5-ish: 148mm x 232mm */}
      <Page size={[420, 658]} style={s.page}>
        <View style={s.card}>
          <Text style={s.paid}>PAID</Text>
          <View style={s.checkWrap}><Text style={s.check}>OK</Text></View>
          <Text style={s.lbl}>Payment received</Text>
          <Text style={s.amount}>
            {money(total(invoice))} <Text style={s.currency}>{invoice.currency}</Text>
          </Text>
          <Text style={s.parties}>
            {invoice.clientName} {"->"} {invoice.fromName}
          </Text>
          <View style={s.dash} />
          {rows.map(([k, v]) => (
            <View key={k} style={s.row}>
              <Text style={s.rowK}>{k}</Text>
              <Text style={s.rowV}>{v}</Text>
            </View>
          ))}
          <View style={s.proof}>
            <View style={s.proofHead}>
              <Text style={[s.lbl, { marginTop: 0 }]}>Proof</Text>
              {sim ? (
                <Text style={[s.pill, { color: signal }]}>Simulated · not on-chain</Text>
              ) : (
                <Text style={[s.pill, { color: mint }]}>Signature verified</Text>
              )}
            </View>
            <View style={s.proofRow}>
              <Text style={s.proofK}>Quote signature</Text>
              <Text style={s.proofV}>{pr?.signature ? short(pr.signature, 12, 6) : "not recorded"}</Text>
            </View>
            <View style={s.proofRow}>
              <Text style={s.proofK}>Signed at</Text>
              <Text style={s.proofV}>{signedAt}</Text>
            </View>
            <View style={s.proofRow}>
              <Text style={s.proofK}>Deposit tx{sim ? " (simulated)" : ""}</Text>
              {txLink && payment.txHash ? (
                <Link src={txLink} style={s.link}>{short(payment.txHash, 10, 6)}</Link>
              ) : (
                <Text style={s.proofV}>{payment.txHash ? short(payment.txHash, 10, 6) : "n/a"}</Text>
              )}
            </View>
            {intents ? (
              <View style={s.proofRow}>
                <Text style={s.proofK}>Intents explorer</Text>
                <Link src={intents} style={s.link}>{short(payment.depositAddress)}</Link>
              </View>
            ) : null}
            <Text style={s.note}>
              {sim
                ? "Mock mode: no funds moved. Signature and tx hash are placeholders."
                : "Ed25519 signature checked with verifyQuoteSignature() from the 1-Click SDK before the deposit address was shown."}
            </Text>
          </View>
          <View style={s.foot}>
            <Text style={[s.pill, { color: mint }]}>
              {payment.mock ? "Simulated status" : "Status from 1-Click"}
            </Text>
            <Text style={[s.pill, { fontFamily: "Courier" }]}>{short(payment.depositAddress)}</Text>
          </View>
        </View>
        <Text style={s.footer}>
          Invoice Link receipt · settled via NEAR Intents (1-Click) · {invoice.number}
        </Text>
      </Page>
    </Document>
  );
}
