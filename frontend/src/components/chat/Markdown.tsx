"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for agent messages.
 * Lightweight + safe (no raw HTML), styled to match the PayMaster dark glass theme.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[13px] leading-relaxed text-gray-200 space-y-2 [&_p]:leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({ children: c }) => <strong className="font-semibold text-white">{c}</strong>,
          em: ({ children: c }) => <em className="text-gray-300 italic">{c}</em>,
          p: ({ children: c }) => <p className="leading-relaxed">{c}</p>,
          a: ({ children: c, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand-cyan underline decoration-brand-cyan/40 underline-offset-2 hover:text-brand-300"
            >
              {c}
            </a>
          ),
          ul: ({ children: c }) => <ul className="space-y-1 list-disc pl-5 marker:text-brand-500">{c}</ul>,
          ol: ({ children: c }) => <ol className="space-y-1 list-decimal pl-5 marker:text-brand-500">{c}</ol>,
          li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          blockquote: ({ children: c }) => (
            <blockquote className="border-l-2 border-amber-400/50 pl-3 py-0.5 text-amber-200/90 text-[12px] italic">
              {c}
            </blockquote>
          ),
          code: ({ children: c, className }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <pre className="my-2 rounded-lg bg-black/50 border border-white/10 p-3 overflow-x-auto text-[12px] text-emerald-200">
                  <code className="font-mono">{c}</code>
                </pre>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded-md bg-brand-500/15 border border-brand-500/20 text-brand-100 font-mono text-[12px]">
                {c}
              </code>
            );
          },
          hr: () => <hr className="border-white/10 my-2" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
