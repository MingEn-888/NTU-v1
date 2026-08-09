import { PaymentCommandCenter } from "@/components/payment/PaymentCommandCenter";

export const metadata = {
  title: "IBAP · AI Payment Operations",
  description:
    "Describe a business payment in plain language. IBAP parses the intent, builds a payment plan, and lets you approve & execute from the treasury.",
};

export default function OperationsPage() {
  return (
    <div className="pb-12">
      <PaymentCommandCenter />
    </div>
  );
}
