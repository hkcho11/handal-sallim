"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";

type WonInputProps = Omit<
  ComponentProps<"input">,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  digitsOnly?: boolean;
};

function formatted(value: string) {
  return /^\d+$/.test(value)
    ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : value;
}

export default function WonInput({
  value,
  onValueChange,
  digitsOnly = false,
  ...props
}: WonInputProps) {
  const [selection, setSelection] = useState<{
    digits: number;
    input: HTMLInputElement;
  }>();
  const previousSelection = useRef<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    if (!selection || document.activeElement !== selection.input) return;
    const display = selection.input.value;
    let position = 0;
    let digits = 0;
    while (position < display.length && digits < selection.digits) {
      if (display[position] !== ",") digits++;
      position++;
    }
    selection.input.setSelectionRange(position, position);
  }, [selection, value]);
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={formatted(value)}
      onSelect={(event) => {
        previousSelection.current = {
          start: event.currentTarget.selectionStart ?? 0,
          end: event.currentTarget.selectionEnd ?? 0,
        };
        props.onSelect?.(event);
      }}
      onChange={(event) => {
        const input = event.currentTarget;
        let raw = input.value.replaceAll(",", "");
        let digits = input.value
          .slice(0, input.selectionStart ?? 0)
          .replaceAll(",", "").length;
        if (digitsOnly) {
          raw = raw.replace(/\D/g, "");
          digits = input.value
            .slice(0, input.selectionStart ?? 0)
            .replace(/\D/g, "").length;
        }
        const prior = previousSelection.current;
        const inputType = (event.nativeEvent as InputEvent).inputType;
        if (
          raw === value &&
          prior &&
          prior.start === prior.end &&
          /^\d+$/.test(raw)
        ) {
          if (
            inputType === "deleteContentBackward" &&
            formatted(value)[prior.start - 1] === ","
          ) {
            raw = raw.slice(0, digits - 1) + raw.slice(digits);
            digits = Math.max(0, digits - 1);
          } else if (
            inputType === "deleteContentForward" &&
            formatted(value)[prior.start] === ","
          ) {
            raw = raw.slice(0, digits) + raw.slice(digits + 1);
          }
        }
        setSelection({ input, digits });
        onValueChange(raw);
      }}
    />
  );
}
