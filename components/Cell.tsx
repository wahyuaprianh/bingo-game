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
          ? { scale: [1, 1.12, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={clickable ? onClick : undefined}
      className={`relative flex aspect-square items-center justify-center rounded-2xl border font-mono text-xl font-bold transition-all duration-200 select-none ${
        onBingoLine
          ? "animate-glow border-transparent bg-gradient-to-br from-gold to-gold-dark text-[#3a2900] shadow-[0_0_15px_rgba(251,191,36,0.4)]"
          : marked
          ? "border-transparent bg-gradient-to-br from-rose to-rose-dark text-[#fff2ee] shadow-[0_6px_14px_rgba(244,63,94,0.3)]"
          : clickable
          ? "border-teal/30 bg-bg-panel/20 text-ink cursor-pointer hover:border-teal hover:bg-teal/5 hover:scale-[1.04] hover:shadow-[0_0_12px_rgba(20,184,166,0.15)]"
          : "border-line bg-bg-panel/40 text-muted/60"
      }`}
    >
      {num}
      {marked && !onBingoLine && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]" />
      )}
    </motion.div>
  );
}
