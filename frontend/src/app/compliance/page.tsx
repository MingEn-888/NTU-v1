import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";

export const metadata = {
  title: "Compliance — PayMaster",
  description: "DPT Treasury Compliance Layer — screening, monitoring, policy, travel rule.",
};

export default function CompliancePage() {
  return <ComplianceDashboard />;
}
