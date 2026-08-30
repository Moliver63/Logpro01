import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-body text-[13px] font-medium tracking-wide text-tintaSuave uppercase">
        {label}
        {required && <span className="ml-1 text-risco">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-tintaSuave">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-card border border-borda bg-white px-3 py-2 font-mono text-[15px] text-tinta " +
  "placeholder:text-tintaSuave/50 focus:border-azul focus:outline-none transition-colors";

export function NumberField(
  props: React.InputHTMLAttributes<HTMLInputElement> & { value: number | ""; onValueChange: (v: number | "") => void }
) {
  const { value, onValueChange, className, ...rest } = props;
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        onValueChange(raw === "" ? "" : Number(raw));
      }}
      className={`${inputBase} ${className ?? ""}`}
    />
  );
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} type="text" className={`${inputBase} ${className ?? ""}`} />;
}

export function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={`${inputBase} appearance-none bg-white ${className ?? ""}`}>
      {children}
    </select>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-borda bg-white shadow-sm shadow-navy/[0.03] ${className ?? ""}`}>{children}</div>
  );
}
