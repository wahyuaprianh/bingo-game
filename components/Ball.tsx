"use client";

import { motion } from "framer-motion";

export default function Ball({ num, latest }: { num: number; latest?: boolean }) {
  return (
    <motion.div
      initial={{ y: -18, scale: 0.5, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-[#3a2900] shadow-ball ${
        latest ? "ring-2 ring-coral ring-offset-2 ring-offset-bg-deep" : ""
      }`}
      style={{
        background:
          "radial-gradient(circle at 35% 30%, #fff5d0, #f2b705 55%, #c48f02 100%)"
      }}
    >
      {num}
    </motion.div>
  );
}
