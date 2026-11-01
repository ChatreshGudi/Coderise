"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function NumberField({ id, name, label, min, max, step = 1, defaultValue = "", placeholder, required = false }: {
  id: string; name: string; label: string; min: number; max: number; step?: number;
  defaultValue?: string | number; placeholder?: string; required?: boolean;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const input = useRef<HTMLInputElement>(null);
  function change(direction: number) {
    if (!input.current) return;
    if (!input.current.value) input.current.value = String(min);
    else if (direction > 0) input.current.stepUp();
    else input.current.stepDown();
    setValue(input.current.value);
  }
  return <div className="number-field">
    <input ref={input} id={id} name={name} type="number" inputMode="numeric" min={min} max={max} step={step} value={value} onChange={event => setValue(event.target.value)} placeholder={placeholder} required={required} />
    <div className="number-field-steps">
      <button type="button" aria-label={`Increase ${label}`} disabled={value !== "" && Number(value) >= max} onClick={() => change(1)}><ChevronUp size={12} aria-hidden="true" /></button>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value !== "" && Number(value) <= min} onClick={() => change(-1)}><ChevronDown size={12} aria-hidden="true" /></button>
    </div>
  </div>;
}
