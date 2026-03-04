import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

interface TextGlitchProps {
  text: string;
  className?: string;
  duration?: number; // ms
  active?: boolean;
}

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':,./<>?";

export function TextGlitch({ text, className, duration = 800, active = true }: TextGlitchProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isGlitching, setIsGlitching] = useState(active);

  useEffect(() => {
    if (!active || !isGlitching) {
      setDisplayText(text);
      return;
    }

    let iterations = 0;
    const interval = setInterval(() => {
      setDisplayText(() => {
        return text
          .split("")
          .map((_, index) => {
            if (index < iterations) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
      });
      // The speed of resolution depends on the string length and total duration
      iterations += text.length / (duration / 50);

      if (iterations >= text.length) {
        clearInterval(interval);
        setDisplayText(text);
        setIsGlitching(false);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [text, duration, active, isGlitching]);

  // Handle hover to re-trigger if wanted
  const handleMouseEnter = () => {
     setIsGlitching(true);
  };

  return (
    <span 
      className={cn("relative inline-block transition-all", className)}
      onMouseEnter={handleMouseEnter}
    >
      {displayText}
    </span>
  );
}
