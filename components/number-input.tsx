"use client";

import { useState, useEffect, useRef } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (v: number) => void;
};

export function NumberInput({ value, onChange, ...props }: Props) {
  const [text, setText] = useState(() => (value === 0 ? "" : String(value)));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setText(value === 0 ? "" : String(value));
    }
  }, [value, focused]);

  return (
    <input
      ref={ref}
      type="number"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw !== "") {
          const num = Number(raw);
          if (!isNaN(num)) onChange(num);
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (text === "") {
          onChange(0);
          setText("");
        }
      }}
      {...props}
    />
  );
}
