"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Landmark, Wallet, MessageSquareText, Inbox } from "lucide-react";
import type { ChatMessage as ChatMessageModel, OperationStage } from "@/lib/payment/types";
import { ChatMessage, type ExecutionResult } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { resolveTokenAddress, buildExplorerUrl } from "@/lib/payment/execution";
import { parsePaymentIntent } from "@/lib/payment/intentParser";
import { generatePaymentPlan } from "@/lib/payment/planGenerator";
import {
  buildIntentNarration,
  buildClarificationNarration,
  buildPlanNarration,
} from "@/lib/payment/agent";

// ---------------------------------------------------------------------------
// Wallet surface needed by the agent (subset of useWallet)
// ---------------------------------------------------------------------------
export interface ChatWalletApi {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  chainId: number | null;
  connect: () => Promise<void>;
  executePayment: (to: string, amount: string, tokenAddress?: string) => Promise<any>;
  executeSmartWalletBatch: (intentId: string, recipient: string, steps: any[]) => Promise<any>;
}

interface ChatWindowProps {
  businessId: string | null;
  businessName?: string;
  wallet: ChatWalletApi;
  onOperationStageChange?: (stage: OperationStage) => void;
}

const SUGGESTIONS = [
  "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
  "Pay contractor $1,200 in USDC.",
  "Settle invoice INV-2048 using treasury.",
  "Reimburse Priya $450 for travel expenses.",
  "Send 500 USDC to David for equipment supplies.",
];

const FALLBACK_RECIPIENT = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

async function apiJson(url: string, init?: RequestInit, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `Request failed (${res.status})`);
    }
    return body;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Payment backend unreachable (timeout).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function ChatWindow({ businessId, businessName, wallet, onOperationStageChange }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessageModel[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingPlanMsgId, setGeneratingPlanMsgId] = useState<string | null>(null);
  const [executingMsgId, setExecutingMsgId] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const streamTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // --- Auto scroll -----------------------------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, executingMsgId, loadingHistory]);

  // --- Cleanup stream timers on unmount --------------------------------------
  useEffect(() => {
    return () => {
      Object.values(streamTimersRef.current).forEach((t) => clearInterval(t));
    };
  }, []);

  // --- Load conversation history ----------------------------------------------
  const loadHistory = useCallback(async (bizId: string) => {
    setLoadingHistory(true);
    try {
      const data = await apiJson(`/api/chat?businessId=${encodeURIComponent(bizId)}`);
      setMessages(data.messages || []);
      // Reflect the latest persisted operation stage if a plan already exists.
      const lastAgent = (data.messages || []).filter((m: ChatMessageModel) => m.role === "agent").pop();
      if (lastAgent?.plan) onOperationStageChange?.("payment_plan");
      else if (lastAgent?.intent) onOperationStageChange?.("payment_request");
    } catch (err: any) {
      console.error("Failed to load chat history:", err);
      setNotice("Could not load conversation history from the treasury store.");
      setOfflineMode(true);
    } finally {
      setLoadingHistory(false);
    }
  }, [onOperationStageChange]);

  useEffect(() => {
    if (!businessId) return;
    loadHistory(businessId);
  }, [businessId, loadHistory]);

  // --- Streaming simulation ---------------------------------------------------
  const startStreaming = useCallback((id: string, fullContent: string) => {
    // Attach intent immediately; stream the narration text progressively.
    let idx = 0;
    const step = 4;
    const timer = setInterval(() => {
      idx = Math.min(fullContent.length, idx + step);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                content: fullContent.slice(0, idx),
                status: idx >= fullContent.length ? "complete" : "streaming",
              }
            : m
        )
      );
      if (idx >= fullContent.length) {
        clearInterval(timer);
        delete streamTimersRef.current[id];
      }
    }, 14);
    streamTimersRef.current[id] = timer;
  }, []);

  // --- Offline helpers ---------------------------------------------------------
  const markOffline = useCallback((message?: string) => {
    setOfflineMode(true);
    setNotice(
      message ||
        "Payment backend unreachable — running in offline demo mode. Parsing and plans work, but history won't be saved."
    );
  }, []);

  /** Parse + narrate a message purely client-side (used when the backend is down). */
  const localProcessMessage = useCallback(
    (text: string) => {
      const intent = parsePaymentIntent(text);
      if (!intent.detected) {
        const local: ChatMessageModel = {
          id: `local-agent-${Date.now()}`,
          role: "agent",
          content: buildClarificationNarration(),
          status: "complete",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, local]);
      } else {
        const local: ChatMessageModel = {
          id: `local-agent-${Date.now()}`,
          role: "agent",
          content: "",
          status: "streaming",
          intent,
          plan: null,
          entityIds: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, local]);
        startStreaming(local.id, buildIntentNarration(intent));
        onOperationStageChange?.("payment_request");
      }
    },
    [startStreaming, onOperationStageChange]
  );

  /** Generate + attach a plan purely client-side. */
  const localProcessPlan = useCallback(
    (msg: ChatMessageModel) => {
      if (!msg.intent) return;
      const plan = generatePaymentPlan(msg.intent);
      const narration = buildPlanNarration(msg.intent, plan);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, content: `${m.content}\n\n${narration}`, plan, status: "complete" } : m
        )
      );
      onOperationStageChange?.("payment_plan");
    },
    [onOperationStageChange]
  );

  // --- Send a message ---------------------------------------------------------
  const handleSend = useCallback(
    async (text: string) => {
      if (!businessId || sending) return;
      const userMsg: ChatMessageModel = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: text,
        status: "complete",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setNotice(null);
      onOperationStageChange?.("natural_language");

      if (offlineMode) {
        localProcessMessage(text);
        setSending(false);
        return;
      }

      try {
        const data = await apiJson("/api/chat", {
          method: "POST",
          body: JSON.stringify({ businessId, message: text }),
        });
        const agent = data.message as ChatMessageModel;
        // Placeholder agent message with streaming status.
        const placeholder: ChatMessageModel = {
          id: agent.id,
          role: "agent",
          content: "",
          status: "streaming",
          intent: agent.intent || null,
          plan: agent.plan || null,
          entityIds: agent.entityIds || null,
          createdAt: agent.createdAt || new Date().toISOString(),
        };
        setMessages((prev) => [...prev, placeholder]);
        startStreaming(agent.id, agent.content || "");
        if (data.operationStage) onOperationStageChange?.(data.operationStage as OperationStage);
      } catch (err: any) {
        // Offline / unreachable backend — parse the intent locally so the
        // Natural Language -> Payment Request flow still works (no persistence).
        markOffline();
        localProcessMessage(text);
      } finally {
        setSending(false);
      }
    },
    [businessId, sending, startStreaming, onOperationStageChange, offlineMode, localProcessMessage, markOffline]
  );

  // --- Generate payment plan --------------------------------------------------
  const handleGeneratePlan = useCallback(
    async (msg: ChatMessageModel) => {
      if (!businessId || !msg.intent || msg.status !== "complete") return;
      setGeneratingPlanMsgId(msg.id);
      setNotice(null);

      // Offline or no persisted request → plan locally.
      if (offlineMode || !msg.entityIds?.paymentRequestId) {
        localProcessPlan(msg);
        setGeneratingPlanMsgId(null);
        return;
      }

      try {
        const data = await apiJson("/api/chat/plan", {
          method: "POST",
          body: JSON.stringify({
            businessId,
            paymentRequestId: msg.entityIds.paymentRequestId,
          }),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  content: data.message?.content || m.content,
                  plan: data.plan || m.plan,
                  entityIds: data.entityIds || m.entityIds,
                  status: "complete",
                }
              : m
          )
        );
        onOperationStageChange?.("payment_plan");
      } catch (err: any) {
        markOffline();
        localProcessPlan(msg);
      } finally {
        setGeneratingPlanMsgId(null);
      }
    },
    [businessId, onOperationStageChange, offlineMode, localProcessPlan, markOffline]
  );

  // --- Approve & execute ------------------------------------------------------
  const handleApprove = useCallback(
    async (msg: ChatMessageModel) => {
      if (!businessId || !msg.intent || !msg.plan || !msg.entityIds || executingMsgId) return;

      if (!wallet.isConnected) {
        setNotice("Connect your wallet to authorise treasury payouts, then tap Approve & Execute again.");
        await wallet.connect();
        return;
      }

      setExecutingMsgId(msg.id);
      setNotice(null);
      onOperationStageChange?.("executing");

      const recipient = msg.intent.recipientAddress || FALLBACK_RECIPIENT;
      const amount = msg.plan.settlementAmount.toString();
      const tokenAddress = resolveTokenAddress(wallet.chainId, msg.plan.settlementAsset);

      try {
        // Real on-chain execution — MetaMask shows a confirmation prompt.
        const receipt = await wallet.executePayment(recipient, amount, tokenAddress || undefined);
        const txHash = receipt?.hash || receipt?.transactionHash || "";
        const explorerUrl = txHash ? buildExplorerUrl(wallet.chainId, txHash) : null;

        // Record the on-chain result (non-fatal — the txn already succeeded).
        try {
          await apiJson("/api/chat/execute", {
            method: "POST",
            body: JSON.stringify({
              businessId,
              paymentRequestId: msg.entityIds.paymentRequestId,
              txHash,
              chainId: wallet.chainId,
              explorerUrl,
              gasUsed: receipt?.gasUsed?.toString?.() || 0,
            }),
          });
        } catch (logErr) {
          console.error("Failed to persist execution result:", logErr);
        }

        setExecutionResults((prev) => ({
          ...prev,
          [msg.id]: { status: "complete", txHash, explorerUrl: explorerUrl || undefined },
        }));
        onOperationStageChange?.("complete");
      } catch (err: any) {
        const errorMessage = err?.message || "Transaction rejected in wallet. No funds moved.";
        try {
          await apiJson("/api/chat/execute", {
            method: "POST",
            body: JSON.stringify({
              businessId,
              paymentRequestId: msg.entityIds.paymentRequestId,
              failed: true,
              chainId: wallet.chainId,
              errorMessage,
            }),
          });
        } catch (logErr) {
          console.error("Failed to log execution failure:", logErr);
        }
        setExecutionResults((prev) => ({
          ...prev,
          [msg.id]: { status: "failed", error: errorMessage },
        }));
        onOperationStageChange?.("approval");
      } finally {
        setExecutingMsgId(null);
      }
    },
    [businessId, wallet, executingMsgId, onOperationStageChange]
  );

  // --- Reject ------------------------------------------------------------------
  const handleReject = useCallback(
    async (msg: ChatMessageModel) => {
      if (!businessId || !msg.entityIds) return;
      try {
        await apiJson("/api/chat/execute", {
          method: "POST",
          body: JSON.stringify({
            businessId,
            paymentRequestId: msg.entityIds.paymentRequestId,
            cancelled: true,
          }),
        });
      } catch (err) {
        console.error("Failed to cancel payment request:", err);
      }
      setExecutionResults((prev) => ({
        ...prev,
        [msg.id]: {
          status: "failed",
          error: "Payment request rejected and cancelled. No funds were moved.",
        },
      }));
      setNotice(null);
    },
    [businessId]
  );

  // --- Derive card phase per message -------------------------------------------
  const phaseFor = (msg: ChatMessageModel): "detected" | "plan" | "executing" | "complete" | "failed" => {
    if (executingMsgId === msg.id) return "executing";
    const res = executionResults[msg.id];
    if (res?.status === "complete") return "complete";
    if (res?.status === "failed") return "failed";
    if (msg.plan) return "plan";
    return "detected";
  };

  // --- Empty state --------------------------------------------------------------
  if (!businessId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[420px] text-center px-6">
        <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-4">
          <Wallet className="h-8 w-8" />
        </div>
        <h3 className="text-white font-bold text-lg">No treasury context loaded</h3>
        <p className="text-gray-500 text-sm max-w-sm mt-2">
          Associate a business profile & wallet to start issuing payment operations to the IBAP agent.
        </p>
      </div>
    );
  }

  const empty = !loadingHistory && messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Conversation scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 pb-4 space-y-5 min-h-0">
        {loadingHistory && (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <span className="h-5 w-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <span className="text-sm">Restoring conversation…</span>
          </div>
        )}

        {empty && <EmptyState businessName={businessName} />}

        {messages.map((m, i) => (
          <ChatMessage
            key={m.id}
            message={m}
            isLast={i === messages.length - 1}
            cardPhase={phaseFor(m)}
            generatingPlan={generatingPlanMsgId === m.id}
            onGeneratePlan={handleGeneratePlan}
            onApprove={handleApprove}
            onReject={handleReject}
            txResult={executionResults[m.id] || null}
          />
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-gray-500 text-xs px-1">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <span>Routing to payment agent…</span>
          </div>
        )}
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-100 text-[12px]">
          <Landmark className="h-4 w-4 shrink-0 text-brand-400 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Input */}
      <div className="pt-3 border-t border-white/10">
        <ChatInput
          onSend={handleSend}
          disabled={sending}
          suggestions={empty ? SUGGESTIONS : []}
        />
      </div>
    </div>
  );
}

function EmptyState({ businessName }: { businessName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-6">
      <div className="relative mb-5">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-accent to-brand-cyan flex items-center justify-center shadow-glow">
          <MessageSquareText className="h-8 w-8 text-white" />
        </div>
        <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#08090d] animate-pulse" />
      </div>
      <h3 className="text-white font-bold text-xl">IBAP Payment Operations</h3>
      <p className="text-gray-500 text-sm max-w-md mt-2 leading-relaxed">
        {businessName ? `${businessName} · ` : ""}Describe a business payment in plain language and I&apos;ll turn it
        into a verifiable, approvable treasury operation.
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-lg text-left">
        {[
          { t: "Natural Language", d: "Describe who, how much & when" },
          { t: "Payment Request", d: "Parsed, structured operation" },
          { t: "Plan → Approval", d: "Route, risk & sign with wallet" },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-cyan">{s.t}</div>
            <div className="text-[11px] text-gray-500 mt-1 leading-snug">{s.d}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 text-[11px] text-gray-600">
        <Inbox className="h-3.5 w-3.5" />
        Start with a suggested instruction above
      </div>
    </div>
  );
}
