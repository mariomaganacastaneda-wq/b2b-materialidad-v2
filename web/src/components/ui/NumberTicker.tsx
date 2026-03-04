import { useEffect, useRef } from "react";
import { useInView, useSpring } from "framer-motion";
import { cn } from "../../lib/utils";

interface NumberTickerProps {
  value: number;
  direction?: "up" | "down";
  className?: string;
  delay?: number; // delay in s
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
}

export default function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  prefix = "",
  suffix = "",
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useSpring(direction === "down" ? value : 0, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      setTimeout(() => {
        motionValue.set(direction === "down" ? 0 : value);
      }, delay * 1000);
    }
  }, [motionValue, isInView, delay, value, direction]);

  useEffect(() => {
    return motionValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(Number(latest.toFixed(decimalPlaces)))}${suffix}`;
      }
    });
  }, [motionValue, decimalPlaces, prefix, suffix]);

  return (
    <span
      className={cn(
        "inline-block tabular-nums tracking-wider",
        className
      )}
      ref={ref}
    />
  );
}
