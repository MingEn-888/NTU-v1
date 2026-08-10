"use client";

import React from "react";
import { Bot, User, AlertCircle } from "lucide-react";
import type { ChatMessage as ChatMessageModel } from "@/lib/payment/types";
import type { ExecutionPlan } from "@/lib/execution/types";
import { Markdown } from "./Markdown";
import PaymentRequestCard, { type PaymentCardPhase } from "@/components/payment/PaymentRequestCard";
import type { SimulationTreasuryLike } from "@/lib/risk/adapter";

export interface ExecutionResult {
  status: "complete" | "failed";
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

interface ChatMessageProps {
  message: ChatMessageModel;
  isLast?: boolean;
  cardPhase?: PaymentCardPhase;
  generatingPlan?: boolean;
  onGeneratePlan?: (msg: ChatMessageModel) => void;
  onApprove?: (msg: ChatMessageModel) => void;
  onReject?: (msg: ChatMessageModel) => void;
  txResult?: ExecutionResult | null;
  simulationContext?: SimulationTreasuryLike | null;
  executionPlan?: ExecutionPlan | null;
}

export function ChatMessage({
  message,
  isLast,
  cardPhase,
  generatingPlan,
  onGeneratePlan,
  onApprove,
  onReject,
  txResult,
  simulationContext,
  executionPlan,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  // --- User message --------------------------------------------------------
  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[82%]">
          <div className="px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600/80 to-brand-accent/80 border border-brand-500/30 text-[13px] text-white leading-relaxed shadow-glass">
            {message.content}
          </div>
          <div className="mt-1 text-right text-[10px] text-gray-600 font-medium">
            {timeLabel(message.createdAt)}
          </div>
        </div>
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-accent border border-white/10 flex items-center justify-center shrink-0 shadow-glow">
          <User className="h-4 w-4 text-white" />
        </div>
      </div>
    );
  }

  // --- Agent message --------------------------------------------------------
  const isTyping = message.status === "streaming" && !message.content;

  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-500 border border-white/10 flex items-center justify-center shrink-0 shadow-glow-cyan">
        <Bot className="h-4 w-4 text-white" />
      </div>

      <div className="max-w-[85%] min-w-0 flex-1">
        <div
          className={`px-4 py-3 rounded-2xl rounded-tl-md border shadow-glass ${
            message.status === "error"
              ? "bg-red-950/40 border-red-500/30"
              : "bg-[#12141d]/90 border-white/10"
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-cyan">PayMaster</span>
            <span className="text-[9px] text-gray-600">Financial Assistant</span>
            {message.status === "streaming" && (
              <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[9px] font-bold uppercase animate-pulse">
                thinking
              </span>
            )}
          </div>

          {isTyping ? (
            <TypingIndicator />
          ) : (
            <>
              {message.content && (
                <div className={message.status === "error" ? "text-red-200" : ""}>
                  <Markdown>{message.content}</Markdown>
                </div>
              )}

              {message.status === "streaming" && message.content && (
                <span className="inline-block h-3.5 w-[2px] bg-brand-400 ml-0.5 align-middle animate-pulse" />
              )}

              {message.intent && (
                <div className="mt-3">
                  <PaymentRequestCard
                    intent={message.intent}
                    plan={message.plan || null}
                    phase={cardPhase || "detected"}
                    generatingPlan={generatingPlan && isLast}
                    onGeneratePlan={() => onGeneratePlan?.(message)}
                    onApprove={() => onApprove?.(message)}
                    onReject={() => onReject?.(message)}
                    txHash={txResult?.txHash}
                    explorerUrl={txResult?.explorerUrl}
                    error={txResult?.error}
                    simulationContext={simulationContext}
                    executionPlan={executionPlan}
                  />
                </div>
              )}

              {message.status === "error" && (
                <div className="mt-2 flex items-start gap-2 text-[12px] text-red-300">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{message.error || "Something went wrong while processing your request."}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-1 text-[10px] text-gray-600 font-medium">{timeLabel(message.createdAt)}</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-brand-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <span className="ml-1 text-[10px] text-gray-500 font-medium">Parsing payment intent…</span>
    </div>
  );
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
