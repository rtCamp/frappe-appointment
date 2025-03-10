import { cn } from "@/lib/utils";
import React, { ElementType, HTMLAttributes } from "react";

type Variant = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "large" | "small" | "muted";
export type TypographyProps = {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  as?: ElementType;
};

const tags: Record<Variant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  p: "p",
  large: "p",
  muted: "p",
  small: "span",
};

const sizes: Record<Variant, string> = {
  h1: "text-3xl font-bold ",
  h2: "text-2xl font-bold",
  h3: "text-xl font-bold ",
  h4: "text-lg font-bold ",
  h5: "text-md font-bold",
  h6: "text-base font-bold ",
  p: "text-sm font-normal",
  large: "text-lg sm:text-md font-bold",
  muted: "text-muted-foreground text-sm font-normal",
  small: "text-xs font-normal",
};

const Typography = ({
  variant = "p",
  children,
  className,
  as,
  ...props
}: TypographyProps & HTMLAttributes<Variant>) => {
  const sizeClasses = sizes[variant];
  const Tag = as || tags[variant];

  return (
    <Tag className={cn("text-primary", sizeClasses, className)} {...props}>
      {children}
    </Tag>
  );
};

export default Typography;
