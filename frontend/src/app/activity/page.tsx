import type { Metadata } from "next";
import { ActivityPage } from "@/components/activity/ActivityPage";

export const metadata: Metadata = {
  title: "Activity — PayMaster",
  description:
    "Live feed of every treasury payment: recipients, amounts, chains, status and settlement details.",
};

export default function ActivityRoute() {
  return <ActivityPage />;
}
