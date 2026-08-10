import { Suspense } from "react";
import { PaymentCommandCenter } from "@/components/payment/PaymentCommandCenter";

export const metadata = {
  title: "PayMaster · Financial Assistant",
  description:
    "Your financial assistant: ask in plain language to pay invoices, reimburse expenses, or settle vendors. PayMaster parses the intent, builds a plan, and lets you approve & execute from the treasury.",
};

export default function OperationsPage() {
  return (
    <div className="pb-12">
      {/* useSearchParams() (deep-links ?prompt= / ?review=) requires a Suspense
          boundary during static generation. */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            Loading your financial assistant…
          </div>
        }
      >
        <PaymentCommandCenter />
      </Suspense>
    </div>
  );
}
