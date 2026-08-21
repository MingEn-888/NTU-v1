import type { Metadata } from "next";
import { TransactionHistoryPage } from "@/components/history/TransactionHistoryPage";

export const metadata: Metadata = {
  title: "Transaction History — PayMaster",
  description:
    "Payment analytics and the full treasury ledger: search and filter every business payment by status, method, recipient and amount.",
};

export default function HistoryRoute() {
  return <TransactionHistoryPage />;
}
