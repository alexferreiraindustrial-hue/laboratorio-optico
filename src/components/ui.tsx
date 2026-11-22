import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-transparent text-sm font-semibold transition-[transform,background-color,box-shadow,border-color] duration-150 [transition-timing-function:var(--ease-out)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--accent)_28%,transparent)] active:translate-y-px md:min-h-9 md:min-w-0",
  {
    variants: {
      variant: {
        default: "lg-gold lab-reference-button border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_24px_-16px_rgba(34,34,34,.10)] hover:bg-[var(--accent-strong)]",
        secondary: "border-[var(--line)] bg-[var(--surface)] font-medium text-[var(--ink)] hover:bg-[var(--accent-soft)]",
        ghost: "font-medium text-[var(--muted)] hover:bg-[var(--accent-soft)]",
        danger: "border-[var(--danger)] bg-[var(--danger-solid)] text-white hover:bg-[var(--bg-963030)]",
      },
      size: {
        default: "h-11 px-4 md:h-9 md:px-3.5",
        sm: "h-11 px-3 text-[13px] md:h-8 md:px-2.5",
        icon: "h-11 w-11 md:h-9 md:w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

const fieldBase =
  "w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] placeholder:text-[var(--muted)] focus:border-[var(--accent)]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, "h-11 px-3 md:h-9", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, "min-h-24 px-3 py-2", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldBase, "h-11 cursor-pointer px-2.5 md:h-9", props.className)} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="text-[12px] font-semibold text-[var(--muted)]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={cn(
        "lg-glass min-w-0 rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--surface)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 md:px-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {children ? <div className="text-[13px] text-[var(--muted)]">{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

export function Feedback({ error, message }: { error?: string | null; message?: string | null }) {
  if (!error && !message) return null;
  return (
    <p className={cn("text-sm", error ? "text-[var(--danger)]" : "text-[var(--ok)]")} role={error ? "alert" : "status"}>
      {error || message}
    </p>
  );
}
