import { cn } from "cn";
import { useId } from "react";

/**
 * The idle Nemu mascot, the round amber firefly (docs/design-system.md, mascot art colours). The
 * Nemu button and the Nemu cursor both draw it. Decorative: the control around it carries the name.
 */
export function NemuMascot({ className }: { className?: string }) {
  // Gradient ids are per instance, so the button and the cursor can share one Shadow DOM.
  const id = `nemu-mascot-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      aria-hidden
      data-nemu-mascot
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={cn("size-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDB35A" />
          <stop offset="1" stopColor="#E07A16" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0.4" stopColor="#F59331" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F59331" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="18" r="15" fill={`url(#${id}-glow)`} />
      <ellipse
        cx="8"
        cy="12"
        rx="6"
        ry="3.4"
        transform="rotate(18 8 12)"
        fill="#FFE7C7"
        stroke="#fff"
        strokeWidth="0.8"
      />
      <ellipse
        cx="24"
        cy="12"
        rx="6"
        ry="3.4"
        transform="rotate(-18 24 12)"
        fill="#FFE7C7"
        stroke="#fff"
        strokeWidth="0.8"
      />
      <circle cx="16" cy="18" r="8.5" fill={`url(#${id}-body)`} stroke="#fff" strokeWidth="2.5" />
      <ellipse cx="13" cy="17.5" rx="1.5" ry="1.9" fill="#fff" />
      <ellipse cx="19" cy="17.5" rx="1.5" ry="1.9" fill="#fff" />
    </svg>
  );
}
