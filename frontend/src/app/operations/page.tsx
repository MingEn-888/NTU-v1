import { PaymentCommandCenter } from "@/components/payment/PaymentCommandCenter";

export const metadata = {
  title: "PayMaster · Financial Assistant",
  description:
    "Your financial assistant: ask in plain language to pay invoices, reimburse expenses, or settle vendors. PayMaster parses the intent, builds a plan, and lets you approve & execute from the treasury.",
};

export default function OperationsPage() {
  return (
    <div className="pb-12">
      <PaymentCommandCenter />
    </div>
  );
}
