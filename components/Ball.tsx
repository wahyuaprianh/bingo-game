"use client";

import { motion } from "framer-motion";

export default function Ball({ num, latest }: { num: number; latest?: boolean }) {
  return (
    <motion.div
      initial={{ y: -10, scale: 0.6, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className={`flex h-7.5 w-7.5 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold shadow-ball select-none transition-all ${
        latest
          ? "bg-gradient-to-br from-teal to-teal-dark text-[#052e2b] ring-2 ring-teal ring-offset-2 ring-offset-bg-deep scale-105"
          : "bg-gradient-to-br from-indigo to-indigo-dark text-white"
      }`}
    >
      {num}
    </motion.div>
  );
}
