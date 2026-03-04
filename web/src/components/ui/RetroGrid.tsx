import { cn } from "../../lib/utils";

interface RetroGridProps {
  className?: string;
}

export function RetroGrid({ className }: RetroGridProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute inset-0 bg-repeat bg-[length:30px_30px]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
          maskImage:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, transparent 80%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, transparent 80%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[20%] bg-gradient-to-b from-[#06b6d4]/[0.05] to-transparent" />
    </div>
  );
}
