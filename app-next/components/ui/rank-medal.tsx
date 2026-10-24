import { cn } from "@/lib/cn";

type Props = {
  position: number;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: "size-7 text-base",
  md: "size-10 text-lg",
  lg: "size-14 text-2xl",
};

/**
 * Gold/silver/bronze medal for top-3. Positions 1/2/3 get a styled badge,
 * everyone else gets a plain numeric ring in gold.
 */
export function RankMedal({ position, size = "md" }: Props) {
  const isTopThree = position >= 1 && position <= 3;
  const palette =
    position === 1
      ? "from-[#FBD56A] via-[#D8AE5C] to-[#8A6A1F] text-[#1a1308] border-[#F2D28B] shadow-[0_0_16px_rgba(216,174,92,0.5)]"
      : position === 2
        ? "from-[#E8E8E8] via-[#C0C0C0] to-[#808080] text-[#1b1b1b] border-[#E8E8E8] shadow-[0_0_14px_rgba(220,220,220,0.4)]"
        : "from-[#D89A6A] via-[#A05A2A] to-[#5A2E12] text-[#2a1808] border-[#CD7F32] shadow-[0_0_12px_rgba(205,127,50,0.4)]";
  if (!isTopThree) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-full border border-gold/50 text-gold font-display font-black",
          SIZE_CLASSES[size],
        )}
      >
        {position}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative grid place-items-center rounded-full border-2 bg-gradient-to-br font-display font-black",
        palette,
        SIZE_CLASSES[size],
      )}
      aria-label={`Rank ${position} medal`}
      title={`Rank ${position}`}
    >
      {position}
    </span>
  );
}
