"use client";

import { motion } from "framer-motion";

export default function Cell({
  num,
  marked,
  onBingoLine,
  onClick,
  clickable
}: {
  num: number;
  marked: boolean;
  onBingoLine: boolean;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <motion.div
      initial={false}
      animate={
        onBingoLine
          ? { scale: 1.04 }
          : marked
          ? { scale: [1, 1.15, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.35, ease: "easeOut" }}
      onClick={clickable ? onClick : undefined}
      className={`relative flex aspect-square items-center justify-center rounded-xl border font-display text-lg font-semibold sm:text-xl transition-all ${
        onBingoLine
          ? "animate-glow border-transparent bg-gradient-to-br from-gold to-gold-dark text-[#3a2900]"
          : marked
          ? "border-transparent bg-gradient-to-br from-coral to-[#e14a3b] text-[#fff2ee] shadow-[0_6px_14px_rgba(255,107,91,0.35)]"
          : clickable
          ? "border-teal/40 bg-bg-deep text-ink cursor-pointer hover:border-teal hover:bg-teal/5 hover:scale-[1.05]"
          : "border-line bg-bg-deep text-ink"
      }`}
    >
      {num}
      {marked && !onBingoLine && (
        <span className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_0_2px_rgba(255,255,255,0.25)]" />
      )}
    </motion.div>
  );
}
