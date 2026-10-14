import { cn } from "@/lib/utils";

export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  const mark = variant === "mark";

  return (
    <img
      src={mark ? "/brand/foresight-mark.png" : "/brand/foresight-logo.png"}
      alt="Foresight"
      width={mark ? 256 : 1086}
      height={mark ? 256 : 362}
      className={cn("shrink-0 object-contain", mark ? "h-12 w-12" : "h-12 w-36", className)}
      decoding="async"
    />
  );
}
