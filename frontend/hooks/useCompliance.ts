"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComplianceAssessment } from "@/lib/compliance/types";

// =============================================================================
// useCompliance — runs the DPT compliance assessment for a transfer.
//
// Given the transfer details, calls POST /api/compliance/assess (deterministic
// pipeline: screening -> monitoring -> risk -> policy -> travel rule ->
// decision). Exposes:
//   - assessment  (full ComplianceAssessment when ready)
//   - loading / error
//   - canExecute  (true ONLY when decision === ALLOW — BLOCK prevents execution)
//   - reEvaluate  (force a re-run)
// =============================================================================

export interface UseComplianceInput {
  intent: string;
  recipient: string | null;
  recipientAddress: string;
  asset: string;
  amountUsd: number;
  network: string;
  customerId?: string;
  businessId?: string;
  txnReference?: string;
  enabled?: boolean;
}

export function useCompliance(input: UseComplianceInput | null) {
  const [assessment, setAssessment] = useState<ComplianceAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const run = useCallback(async (force = false) => {
    if (!input || !input.enabled) return;
    if (!force && (loading || assessment)) return;

    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      // Unique business reference for the audit record. When the caller doesn't
      // supply one, generate a short timestamp-based reference so every
      // assessment is individually auditable (never the default TX-00001).
      const txnReference =
        input.txnReference ||
        `TX-${Date.now().toString(36).slice(-6).toUpperCase()}${Math.floor(10 + Math.random() * 89)}`;
      const res = await fetch("/api/compliance/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: input.intent,
          recipient: input.recipient,
          recipientAddress: input.recipientAddress,
          asset: input.asset,
          amountUsd: input.amountUsd,
          network: input.network,
          customerId: input.customerId ?? "cust_techcorp",
          businessId: input.businessId,
          txnReference,
        }),
      });
      const data = await res.json();
      if (id !== requestIdRef.current) return; // stale response
      if (!res.ok) throw new Error(data?.error?.message || `Compliance request failed (${res.status})`);
      setAssessment(data.assessment);
    } catch (err: any) {
      if (id !== requestIdRef.current) return;
      setError(err?.message || "Compliance assessment failed.");
      setAssessment(null);
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [input, loading, assessment]);

  useEffect(() => {
    if (input?.enabled) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(input), input?.enabled]);

  const canExecute = assessment?.decision === "ALLOW";
  const isBlocked = assessment?.decision === "BLOCK";
  const needsReview = assessment?.decision === "REVIEW";

  return {
    assessment,
    loading,
    error,
    canExecute,
    isBlocked,
    needsReview,
    reEvaluate: () => run(true),
  };
}
