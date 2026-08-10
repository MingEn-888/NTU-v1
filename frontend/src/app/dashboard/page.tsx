import { DashboardPage } from "@/components/dashboard/DashboardPage";

export const metadata = {
  title: "PayMaster · Business Payments",
  description:
    "Corporate payment automation dashboard: treasury position, financial assistant, route optimization analytics, and the human approval queue.",
};

export default function DashboardRoute() {
  return <DashboardPage />;
}
