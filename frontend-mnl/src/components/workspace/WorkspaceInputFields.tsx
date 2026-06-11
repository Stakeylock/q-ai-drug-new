"use client";

import { Input, Textarea } from "@/components/ui";

interface FieldBaseProps {
  id: string;
  label: string;
  helperText?: string;
  disabled?: boolean;
}

interface ProteinSequenceFieldProps extends FieldBaseProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}

interface NumberSliderFieldProps extends FieldBaseProps {
  value: number;
  onChange: (nextValue: number) => void;
  min: number;
  max: number;
  step?: number;
}

interface SelectFieldOption {
  label: string;
  value: string;
}

interface SelectFieldProps extends FieldBaseProps {
  value: string;
  onChange: (nextValue: string) => void;
  options: SelectFieldOption[];
}

function HelperText({ text }: { text?: string }) {
  if (!text) {
    return null;
  }

  return <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--muted-text)" }}>{text}</p>;
}

export function ProteinSequenceField({
  id,
  label,
  helperText,
  value,
  onChange,
  placeholder,
  disabled,
}: ProteinSequenceFieldProps) {
  const helperId = `${id}-helper`;

  return (
    <div>
      <Textarea
        id={id}
        label={label}
        rows={8}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="font-mono text-xs leading-5"
        aria-describedby={helperText ? helperId : undefined}
      />
      {helperText ? (
        <p id={helperId} className="mt-1.5 text-xs leading-5" style={{ color: "var(--muted-text)" }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function NumberSliderField({
  id,
  label,
  helperText,
  value,
  onChange,
  disabled,
  min,
  max,
  step = 0.01,
}: NumberSliderFieldProps) {
  const helperId = `${id}-helper`;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_88px] items-end gap-2">
        <Input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          className="h-2 cursor-pointer appearance-none rounded-full border-none px-0 py-0"
          style={{ backgroundColor: "var(--muted-bg)", accentColor: "var(--accent)" }}
          label={label}
          aria-describedby={helperText ? helperId : undefined}
        />
        <Input
          id={`${id}-number`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          containerClassName="pt-7"
          className="text-center"
          aria-label={`${label} numeric input`}
          aria-describedby={helperText ? helperId : undefined}
        />
      </div>
      <div className="flex justify-between text-[11px]" style={{ color: "var(--muted-text)" }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {helperText ? (
        <p id={helperId} className="text-xs leading-5" style={{ color: "var(--muted-text)" }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({ id, label, helperText, value, onChange, options, disabled }: SelectFieldProps) {
  const helperId = `${id}-helper`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium" style={{ color: "var(--text)" }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby={helperText ? helperId : undefined}
        className="w-full rounded-lg border px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
          color: "var(--text)",
          accentColor: "var(--accent)",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <HelperText text={helperText} />
    </div>
  );
}
