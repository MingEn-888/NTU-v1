import type { Metadata } from "next";
import { PaymentHistory } from "@/components/payments/PaymentHistory";

export const metadata: Metadata = {
  title: "Payment History — PayMaster",
  description:
    "Full treasury ledger: search and filter every business payment by status, payment method, recipient and amount.",
};

export default function PaymentsRoute() {
  return <PaymentHistory />;
}
