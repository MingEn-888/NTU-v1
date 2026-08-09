"use client";

import React, { useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Describe a business payment… e.g. "Pay Alice RM2,500 for invoice INV-1024 by Friday."',
  suggestions = [],
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    resize();
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-3">
      {/* Suggested business payment instructions */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <Sparkles className="h-3.5 w-3.5 text-brand-cyan shrink-0" />
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              disabled={disabled}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/5 hover:bg-brand-500/15 border border-white/10 hover:border-brand-500/40 text-gray-300 hover:text-white transition-all disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full resize-none rounded-2xl glass-input border border-white/10 focus:border-brand-500/50 py-3.5 pl-4 pr-14 text-[13px] text-white placeholder:text-gray-500 disabled:opacity-50 focus:outline-none shadow-glass"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="absolute right-2 bottom-2 h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-500 text-white flex items-center justify-center shadow-glow disabled:opacity-40 disabled:hover:from-brand-600 disabled:hover:to-brand-accent transition-all"
          aria-label="Send message"
        >
          {disabled ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium px-1">
        <span>Enter to send · Shift+Enter for newline</span>
        <span className="text-brand-cyan/70 font-semibold">No funds move until you approve</span>
      </div>
    </div>
  );
}
