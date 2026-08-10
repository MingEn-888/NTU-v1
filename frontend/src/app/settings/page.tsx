import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata: Metadata = {
  title: "Settings — PayMaster",
  description:
    "Global settings & preferences for PayMaster: theme (Light / Dark / System), multi-ecosystem networks, wallet, notifications, profile and security.",
};

export default function SettingsRoute() {
  return <SettingsPage />;
}
