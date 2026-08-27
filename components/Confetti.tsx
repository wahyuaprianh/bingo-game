"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#f2b705", "#ff6b5b", "#2ec4b6", "#ffcf3d", "#eaf4f4"];

export default function Confetti({ show }: { show: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.2,
        rotate: Math.random() * 360,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6
      })),
    []
  );

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ top: "-5%", left: `${p.x}%`, opacity: 1, rotate: 0 }}
          animate={{ top: "110%", rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color
          }}
        />
      ))}
    </div>
  );
}
