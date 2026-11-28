import { cn } from "cn";
import { useId } from "react";

export type NemuMascotMood = "idle" | "success" | "warning";

/** Body gradient and glow per mood (docs/design-system.md, mascot art colours). */
const COLOURS: Record<NemuMascotMood, { from: string; to: string; glow: string }> = {
  idle: { from: "#FDB35A", to: "#E07A16", glow: "#F59331" },
  success: { from: "#34D399", to: "#059669", glow: "#34D399" },
  warning: { from: "#F87171", to: "#DC2626", glow: "#F87171" },
};

/**
 * The Nemu mascot, the round firefly (docs/design-system.md, mascot art colours). The Nemu button
 * and the Nemu cursor draw it idle (amber); a display heading draws it `success` (green, happy
 * eyes, check badge) or `warning` (red, "!" badge). Decorative: the control around it carries the
 * name.
 */
export function NemuMascot({
  mood = "idle",
  className,
}: {
  mood?: NemuMascotMood;
  className?: string;
}) {
  // Gradient ids are per instance, so the button and the cursor can share one Shadow DOM.
  const id = `nemu-mascot-${useId().replace(/[^\w-]/g, "")}`;
  const colours = COLOURS[mood];
  return (
    <svg
      aria-hidden
      data-nemu-mascot={mood}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={cn("size-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colours.from} />
          <stop offset="1" stopColor={colours.to} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0.4" stopColor={colours.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={colours.glow} stopOpacity="0" />
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
      {mood === "success" ? (
        <path
          d="M11.6 18.2q1.4-1.8 2.8 0M17.6 18.2q1.4-1.8 2.8 0"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ) : (
        <>
          <ellipse cx="13" cy="17.5" rx="1.5" ry="1.9" fill="#fff" />
          <ellipse cx="19" cy="17.5" rx="1.5" ry="1.9" fill="#fff" />
        </>
      )}
      {mood === "success" && (
        <g>
          <circle cx="25" cy="25" r="5" fill="#047857" stroke="#fff" strokeWidth="1.2" />
          <path
            d="M22.8 25.1l1.5 1.5 2.9-3"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {mood === "warning" && (
        <g>
          <circle cx="25" cy="25" r="5" fill="#991B1B" stroke="#fff" strokeWidth="1.2" />
          <path d="M25 22.4v3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="25" cy="27.6" r="0.9" fill="#fff" />
        </g>
      )}
    </svg>
  );
}
