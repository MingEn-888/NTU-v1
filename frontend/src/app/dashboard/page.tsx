import { DashboardPage } from "@/components/dashboard/DashboardPage";

export const metadata = {
  title: "IBAP · Business Payment Operations",
  description:
    "Corporate payment automation dashboard: treasury position, AI payment agent, route optimization analytics, and the human approval queue.",
};

export default function DashboardRoute() {
  return <DashboardPage />;
}
