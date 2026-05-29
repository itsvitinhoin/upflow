"use client";

import { type InputHTMLAttributes, useEffect, useState } from "react";
import {
  formatIsoDateInput,
  maskBrazilianDateInput,
  parseBrazilianDateInput,
} from "@/lib/utils";

interface BrazilianDateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: string | null;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
}

export default function BrazilianDateInput({
  value,
  onChange,
  onCommit,
  ...props
}: BrazilianDateInputProps) {
  const [text, setText] = useState(() => formatIsoDateInput(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatIsoDateInput(value));
    setInvalid(false);
  }, [value]);

  const commit = (nextText: string) => {
    const parsed = parseBrazilianDateInput(nextText);
    setInvalid(parsed === "invalid");
    if (parsed === "invalid") return;
    const nextValue = parsed ?? "";
    onChange(nextValue);
    onCommit?.(nextValue);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      value={text}
      aria-invalid={invalid}
      onChange={(event) => {
        const masked = maskBrazilianDateInput(event.target.value);
        setText(masked);
        setInvalid(false);
        if (masked.length === 0 || masked.length === 10) {
          const parsed = parseBrazilianDateInput(masked);
          if (parsed !== "invalid") onChange(parsed ?? "");
        }
      }}
      onBlur={() => commit(text)}
      {...props}
    />
  );
}
