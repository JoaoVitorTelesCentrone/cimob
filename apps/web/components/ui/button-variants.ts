import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center gap-2 rounded-pill border font-semibold whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-brand bg-brand text-on-brand hover:border-brand-strong hover:bg-brand-strong after:content-['↗'] after:text-[13px]",
        secondary: "border-line bg-surface-raised text-ink hover:bg-surface",
        danger: "border-line bg-surface-raised text-danger hover:bg-danger-soft",
      },
      size: {
        md: "h-10 px-5 text-sm",
        sm: "h-8 px-4 text-[12.5px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
