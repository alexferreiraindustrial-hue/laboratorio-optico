import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0e6b62]/25",
  {
    variants: {
      variant: {
        default: "border-[#0e6b62] bg-[#0e6b62] text-white hover:bg-[#0b5850]",
        secondary: "border-[#cdd5d8] bg-white font-medium text-[#13201f] hover:bg-[#f7f9f9]",
        ghost: "font-medium text-[#44524f] hover:bg-[#f2f4f5]",
        danger: "border-[#b42318] bg-[#b42318] text-white hover:bg-[#912018]",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-2.5 text-[13px]",
        icon: "h-9 w-9",
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
  "w-full rounded-lg border border-[#cdd5d8] bg-white text-sm text-[#13201f] outline-none transition-shadow placeholder:text-[#8a9694] focus:border-[#0e6b62]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, "h-9 px-3", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, "min-h-24 px-3 py-2", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldBase, "h-9 cursor-pointer px-2.5", props.className)} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-[#44524f]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[#6e7c7a]">{hint}</span> : null}
    </label>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-[#e2e7e9] bg-white", className)}>{children}</section>;
}

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#e2e7e9] px-5 py-3.5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children ? <div className="text-[13px] text-[#6e7c7a]">{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#cdd5d8] bg-white px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-sm text-[#6e7c7a]">{text}</p>
    </div>
  );
}

export function Feedback({ error, message }: { error?: string | null; message?: string | null }) {
  if (!error && !message) return null;
  return (
    <p className={cn("text-sm", error ? "text-[#b42318]" : "text-[#1c6b43]")} role={error ? "alert" : "status"}>
      {error || message}
    </p>
  );
}
