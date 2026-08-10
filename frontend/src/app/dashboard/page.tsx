import { BusinessDashboard } from "@/components/business/BusinessDashboard";

export const metadata = {
  title: "PayMaster · Business Payments",
  description:
    "Corporate payment operations dashboard: treasury overview, AI payment command, settlement rails, spending insights, payment activity and the human approval queue.",
};

export default function DashboardRoute() {
  return <BusinessDashboard />;
}
