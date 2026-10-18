const DOT_DELAYS = ["0ms", "150ms", "300ms"];

/**
 * Membaca (docs/design-system.md, "Composer"): once a prompt is sent, the Composer gives way to a
 * narrower pill with no buttons until the answer arrives.
 */
export function ReadingPill() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex h-10 w-fit items-center gap-2 self-start rounded-2xl bg-nemu px-3.5 py-[5px] text-[13px] leading-[18px] whitespace-nowrap text-nemu-foreground shadow-nemu-float"
    >
      <span aria-hidden="true" className="flex gap-1">
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-pulse rounded-full bg-nemu-foreground motion-reduce:animate-none"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      Membaca halaman dan SOP…
    </div>
  );
}
