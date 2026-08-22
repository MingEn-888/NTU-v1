import type { Metadata } from "next";
import { DemoWalkthrough } from "@/components/demo/DemoWalkthrough";

export const metadata: Metadata = {
  title: "Product Demo — PayMaster",
  description:
    "End-to-end PayMaster demo: 'Pay Alice $2,500 for invoice INV-1024 by Friday.' — from natural-language instruction to audited SmartWallet transaction.",
};

export default function DemoPage() {
  return <DemoWalkthrough />;
}
