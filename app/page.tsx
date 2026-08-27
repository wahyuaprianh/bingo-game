"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Role,
  Room,
  checkBingo,
  getCompletedLines,
  genBoard,
  genPlayerId,
  genRoomCode,
  shuffle
} from "@/lib/game";
import { sfx, unlockAudio } from "@/lib/sound";
import Ball from "@/components/Ball";
import Cell from "@/components/Cell";
import Confetti from "@/components/Confetti";

type Screen = "home" | "wait" | "game" | "result";

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.25, ease: "easeOut" as const }
};

function roomRef(code: string) {
  return doc(db, "rooms", code);
}

function getLineCoordinates(line: number[]) {
  const sorted = line.slice().sort((a, b) => a - b);
  // Diagonal 1 [0, 6, 12, 18, 24]
  if (sorted[0] === 0 && sorted[4] === 24) {
    return { x1: "10%", y1: "10%", x2: "90%", y2: "90%" };
  }
  // Diagonal 2 [4, 8, 12, 16, 20]
  if (sorted[0] === 4 && sorted[4] === 20) {
    return { x1: "90%", y1: "10%", x2: "10%", y2: "90%" };
  }
  // Row (consecutive indices)
  const isRow = sorted[1] - sorted[0] === 1;
  if (isRow) {
    const r = Math.floor(sorted[0] / 5);
    const y = `${r * 20 + 10}%`;
    return { x1: "10%", y1: y, x2: "90%", y2: y };
  }
  // Column
  const c = sorted[0] % 5;
  const x = `${c * 20 + 10}%`;
  return { x1: x, y1: "10%", x2: x, y2: "90%" };
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const [roomCode, setRoomCode] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [board, setBoard] = useState<number[] | null>(null);
  const [copied, setCopied] = useState(false);

  const playerIdRef = useRef<string>("");
  const lastDrawnCount = useRef(0);
  const handledWinLocally = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let pid = localStorage.getItem("bingo_pid");
    if (!pid) {
      pid = genPlayerId();
      localStorage.setItem("bingo_pid", pid);
    }
    playerIdRef.current = pid;
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  function listenRoom(code: string) {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = onSnapshot(
      roomRef(code),
      (snap) => {
        setConnected(true);
        if (!snap.exists()) return;
        const data = snap.data() as Room;
        setRoom(data);
      },
      () => setConnected(false)
    );
  }

  async function handleCreate() {
    console.log("handleCreate called. Name:", name);
    if (!name.trim()) {
      setError("Isi nama dulu ya.");
      return;
    }
    setError("");
    unlockAudio();

    const code = genRoomCode();
    const myBoard = genBoard();
    console.log("Generated Room Code:", code, "Board:", myBoard);
    localStorage.setItem("bingo_board_" + code, JSON.stringify(myBoard));

    const newRoom: Room = {
      code,
      hostId: playerIdRef.current,
      hostName: name.trim(),
      guestId: null,
      guestName: null,
      status: "waiting",
      drawnNumbers: [],
      currentTurn: "host",
      winner: null,
      hostScore: 0,
      guestScore: 0
    };

    console.log("Saving new room to Firestore...", newRoom);
    try {
      await setDoc(roomRef(code), newRoom);
      console.log("Successfully saved room to Firestore!");
    } catch (err) {
      console.error("Firebase setDoc error:", err);
      setError("Gagal terhubung ke server: " + (err instanceof Error ? err.message : String(err)));
      return;
    }

    setRoomCode(code);
    setRole("host");
    setBoard(myBoard);
    setRoom(newRoom);
    setScreen("wait");
    listenRoom(code);
  }

  async function handleJoin() {
    const code = codeInput.trim().toUpperCase();
    console.log("handleJoin called. Name:", name, "Code:", code);
    if (!name.trim()) {
      setError("Isi nama dulu ya.");
      return;
    }
    if (!code) {
      setError("Isi kode room dulu ya.");
      return;
    }
    setError("");
    unlockAudio();

    let snap;
    console.log("Fetching room from Firestore with code:", code);
    try {
      snap = await getDoc(roomRef(code));
      console.log("Successfully fetched room from Firestore. Exists:", snap.exists());
    } catch (err) {
      console.error("Firebase getDoc error:", err);
      setError("Gagal terhubung ke server: " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    if (!snap.exists()) {
      setError("Room tidak ditemukan. Cek kembali kodenya.");
      return;
    }
    const existing = snap.data() as Room;
    if (existing.status !== "waiting") {
      setError("Room ini sudah penuh atau sudah berjalan.");
      return;
    }

    const myBoard = genBoard();
    localStorage.setItem("bingo_board_" + code, JSON.stringify(myBoard));

    await updateDoc(roomRef(code), {
      guestId: playerIdRef.current,
      guestName: name.trim(),
      status: "playing"
    });

    const fresh = (await getDoc(roomRef(code))).data() as Room;
    setRoomCode(code);
    setRole("guest");
    setBoard(myBoard);
    setRoom(fresh);
    lastDrawnCount.current = 0;
    handledWinLocally.current = false;
    setScreen("game");
    listenRoom(code);
  }

  // React to room changes (join detection, win detection, score synchronization)
  useEffect(() => {
    if (!room || !role) return;

    if (screen === "wait" && room.status === "playing" && room.guestId) {
      sfx("join", soundOn);
      lastDrawnCount.current = 0;
      handledWinLocally.current = false;
      setScreen("game");
    }

    if (screen === "game" && board) {
      const drawnSet = new Set(room.drawnNumbers);
      if (room.drawnNumbers.length !== lastDrawnCount.current) {
        if (room.drawnNumbers.length > lastDrawnCount.current && lastDrawnCount.current > 0) {
          sfx("draw", soundOn);
        }
        lastDrawnCount.current = room.drawnNumbers.length;
      }

      // Calculate completed lines locally
      const localLines = getCompletedLines(board, drawnSet);
      const localScore = localLines.length;

      // Sync local score to Firestore if it is different
      const dbScore = role === "host" ? room.hostScore : room.guestScore;
      if (localScore !== dbScore && room.status === "playing") {
        const scoreField = role === "host" ? "hostScore" : "guestScore";
        updateDoc(roomRef(roomCode), { [scoreField]: localScore }).catch((err) => {
          console.error("Failed to update score in Firestore:", err);
        });
      }

      // Win check: if score >= 5, claim the win
      if (room.status === "playing" && localScore >= 5 && !handledWinLocally.current) {
        handledWinLocally.current = true;
        claimWin();
      }

      if (room.status === "finished" && room.winner) {
        sfx(room.winner === role ? "win" : "lose", soundOn);
        setScreen("result");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, screen, board]);

  async function claimWin() {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef(roomCode));
        if (!snap.exists()) return;
        const r = snap.data() as Room;
        if (r.winner) return;
        tx.update(roomRef(roomCode), { winner: role, status: "finished" });
      });
    } catch {
      /* ignore, snapshot resyncs */
    }
  }

  async function handleSelectCell(num: number) {
    if (!room || !role) return;
    if (room.status !== "playing" || room.currentTurn !== role) return;
    if (room.drawnNumbers.includes(num)) return;

    sfx("draw", soundOn);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef(roomCode));
        if (!snap.exists()) return;
        const r = snap.data() as Room;
        if (r.status !== "playing" || r.currentTurn !== role || r.drawnNumbers.includes(num)) return;
        const drawnNumbers = r.drawnNumbers.concat([num]);
        const currentTurn: Role = r.currentTurn === "host" ? "guest" : "host";
        tx.update(roomRef(roomCode), { drawnNumbers, currentTurn });
      });
    } catch (err) {
      console.error("Error selecting number:", err);
    }
  }

  function handleNewGame() {
    if (unsubRef.current) unsubRef.current();
    setRoomCode("");
    setRole(null);
    setRoom(null);
    setBoard(null);
    setCodeInput("");
    lastDrawnCount.current = 0;
    handledWinLocally.current = false;
    setScreen("home");
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const drawnSet = new Set(room?.drawnNumbers ?? []);
  const completedLines = board ? getCompletedLines(board, drawnSet) : [];
  const bingoIndices = new Set(completedLines.flat());
  const isMyTurn = !!room && !!role && room.currentTurn === role;
  const oppName = room && role ? (role === "host" ? room.guestName : room.hostName) : null;
  const iWon = room?.winner === role;
  const myScore = role === "host" ? (room?.hostScore ?? 0) : (room?.guestScore ?? 0);
  const oppScore = role === "host" ? (room?.guestScore ?? 0) : (room?.hostScore ?? 0);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-6 bg-[#090a0f] text-[#f4f4f5]">
      {screen !== "home" && (
        <div className="fixed right-3 top-3 z-40 rounded-full border border-line bg-bg-panel px-3 py-1 text-[10px] tracking-widest text-muted select-none">
          <span className={connected ? "text-teal" : ""}>
            {connected ? "LIVE" : "MENGHUBUNGKAN..."}
          </span>
        </div>
      )}

      <Confetti show={screen === "result" && iWon} />

      <div className="w-full max-w-[340px] sm:max-w-[380px] flex flex-col justify-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo to-violet-600 shadow-md">
            <span className="font-mono text-lg font-black text-white select-none">B</span>
            <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-bg-deep bg-teal" />
          </div>
          <div className="flex flex-col text-left">
            <h1 className="bg-gradient-to-r from-indigo via-purple-400 to-teal bg-clip-text font-sans text-2xl font-extrabold tracking-tight text-transparent leading-none">
              BINGO DUEL
            </h1>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted mt-0.5 leading-none">Realtime Multiplayer</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {screen === "home" && (
            <motion.div key="home" {...fade}>
              <div className="mb-4 rounded-3xl border border-line bg-bg-panel/40 backdrop-blur-md p-6 shadow-panel">
                <div className="mb-1.5 text-[11px] uppercase tracking-[3px] text-teal font-bold">
                  Mulai Permainan
                </div>
                <h2 className="mb-1 font-sans text-xl font-bold">Siapa namamu?</h2>
                <p className="mb-5 text-[13px] leading-relaxed text-muted">
                  Buat room baru lalu bagikan kodenya, atau masukkan kode dari temanmu. Real-time,
                  bisa dimainkan di 2 perangkat berbeda.
                </p>

                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted/80 font-semibold">
                  Nama Pemain
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Wahyu"
                  className="mb-5 w-full rounded-xl border border-line/70 bg-bg-deep/80 px-4 py-3.5 text-[15px] text-ink outline-none transition-all focus:border-teal/80 focus:ring-2 focus:ring-teal/15 focus:bg-bg-deep"
                />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo to-violet-600 hover:from-indigo-dark hover:to-violet-700 py-3.5 font-sans text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.25)] transition-all"
                >
                  Buat Room Baru
                </motion.button>

                <div className="my-5 flex items-center gap-3 text-[11px] tracking-widest text-muted/60">
                  <span className="h-px flex-1 bg-line/65" />
                  ATAU
                  <span className="h-px flex-1 bg-line/65" />
                </div>

                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted/80 font-semibold">
                  Kode Room
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="mis. K3J9P"
                  className="mb-5 w-full rounded-xl border border-line/70 bg-bg-deep/80 px-4 py-3.5 text-[15px] uppercase font-mono tracking-widest text-ink outline-none transition-all focus:border-teal/80 focus:ring-2 focus:ring-teal/15 focus:bg-bg-deep"
                />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleJoin}
                  className="w-full rounded-xl border border-line hover:border-teal/50 bg-bg-panel/20 hover:bg-teal/5 py-3.5 font-sans text-[15px] font-semibold text-teal transition-all"
                >
                  Gabung ke Room
                </motion.button>

                {error && <div className="mt-3 text-center text-xs text-rose">{error}</div>}
              </div>
              <div className="text-center text-[11px] leading-relaxed text-muted/80">
                25 angka acak · garis horizontal, vertikal, atau diagonal = BINGO 🎉
              </div>
            </motion.div>
          )}

          {screen === "wait" && room && (
            <motion.div key="wait" {...fade}>
              <div className="rounded-3xl border border-line bg-bg-panel/40 backdrop-blur-md p-6 shadow-panel">
                <div className="mb-1.5 text-[11px] uppercase tracking-[3px] text-teal font-bold">
                  Menunggu Lawan
                </div>
                <h2 className="mb-1 font-sans text-xl font-bold">Ajak temanmu main</h2>
                <p className="mb-5 text-[13px] leading-relaxed text-muted">
                  Bagikan kode room ini ke temanmu, ia buka link yang sama (boleh di HP/laptop
                  berbeda) lalu memasukkan kode ini.
                </p>

                <div className="mb-6 flex items-center justify-between rounded-2xl border border-line bg-bg-deep/80 px-5 py-4.5">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-muted/60 mb-1">KODE ROOM</div>
                    <div className="font-mono text-3xl font-extrabold tracking-[0.2em] text-gold animate-pulse">
                      {roomCode}
                    </div>
                  </div>
                  <button
                    onClick={copyCode}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all ${
                      copied
                        ? "bg-teal/15 text-teal border border-teal/20"
                        : "bg-bg-panel hover:bg-bg-panel-2 text-ink border border-line"
                    }`}
                  >
                    {copied ? "TERSALIN" : "SALIN"}
                  </button>
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-line bg-bg-deep/50 px-4 py-3.5 text-[13px] font-medium text-ink">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal"></span>
                    </span>
                    {room.hostName} (kamu)
                  </div>
                  <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-dashed border-line/70 bg-bg-deep/20 px-4 py-3.5 text-[13px] font-medium text-muted/40">
                    <span className="h-2 w-2 rounded-full bg-line animate-pulse"></span>
                    Menunggu lawan...
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2.5 text-[13px] text-muted/80">
                  <span className="h-2 w-2 animate-pulse-dot rounded-full bg-teal" />
                  <span
                    className="h-2 w-2 animate-pulse-dot rounded-full bg-teal"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="h-2 w-2 animate-pulse-dot rounded-full bg-teal"
                    style={{ animationDelay: "0.4s" }}
                  />
                  &nbsp;menunggu pemain kedua bergabung...
                </div>

                <button
                  onClick={handleNewGame}
                  className="mt-6 w-full rounded-xl border border-line hover:border-rose/50 bg-bg-panel/20 hover:bg-rose/5 py-3 text-[15px] font-sans font-semibold text-muted hover:text-rose transition-all"
                >
                  Batalkan
                </button>
              </div>
            </motion.div>
          )}

          {screen === "game" && room && board && (
            <motion.div key="game" {...fade}>
              <div className="mb-3 flex items-center justify-between gap-2 select-none">
                <div
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                    isMyTurn
                      ? "border-teal/30 bg-teal/10 text-teal"
                      : "border-indigo/35 bg-indigo/10 text-indigo"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isMyTurn ? "bg-teal animate-pulse" : "bg-indigo"}`} />
                  {isMyTurn ? "Giliran Anda" : `Giliran ${oppName ?? "Lawan"}`}
                </div>
                <button
                  onClick={() => setSoundOn((s) => !s)}
                  className="rounded-full border border-line hover:border-teal/50 bg-bg-panel/20 hover:bg-teal/5 px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-teal transition-all"
                >
                  {soundOn ? "🔊 Suara: On" : "🔇 Suara: Off"}
                </button>
              </div>

              <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-bg-deep/50 px-3 py-2 text-[11px] text-muted/80 select-none">
                <span>
                  Room: <b className="text-ink font-mono tracking-wider">{roomCode}</b>
                </span>
                <span>
                  Lawan: <b className="text-ink">{oppName ?? "-"}</b>
                </span>
              </div>

              {/* Ultra-Compact Score Panel (Single Row) */}
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-bg-panel/30 p-3 shadow-sm text-xs font-semibold select-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted/60 font-bold uppercase">KAMU:</span>
                  <div className="flex gap-0.5">
                    {["B", "I", "N", "G", "O"].map((l, i) => (
                      <span
                        key={l}
                        className={`flex h-6 w-6 items-center justify-center rounded-lg font-sans text-xs font-black transition-all ${
                          myScore > i
                            ? "bg-gradient-to-br from-gold to-gold-dark text-[#3a2900] shadow-[0_0_8px_rgba(251,191,36,0.3)] scale-105"
                            : "border border-line bg-bg-deep/40 text-muted/20"
                        }`}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="h-6 w-px bg-line/65" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted/60 font-bold uppercase">LAWAN:</span>
                  <div className="flex gap-0.5">
                    {["B", "I", "N", "G", "O"].map((l, i) => (
                      <span
                        key={l}
                        className={`flex h-6 w-6 items-center justify-center rounded-lg font-sans text-xs font-black transition-all ${
                          oppScore > i
                            ? "bg-gradient-to-br from-rose to-rose-dark text-white shadow-[0_0_8px_rgba(244,63,94,0.25)] scale-105"
                            : "border border-line bg-bg-deep/40 text-muted/20"
                        }`}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inline Called History Track */}
              <div className="mb-3 rounded-2xl border border-line bg-bg-deep/50 px-3 py-2">
                <div className="flex gap-1.5 items-center overflow-hidden">
                  <span className="text-[9px] uppercase tracking-wider text-muted/60 font-bold mr-1 flex-shrink-0">
                    RIWAYAT ({room.drawnNumbers.length}):
                  </span>
                  <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                    <AnimatePresence initial={false}>
                      {room.drawnNumbers.map((n, i) => (
                        <Ball key={n} num={n} latest={i === room.drawnNumbers.length - 1} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="relative mb-3">
                <div className="grid grid-cols-5 gap-2 w-full aspect-square">
                  {board.map((n, idx) => {
                    const marked = drawnSet.has(n);
                    const clickable = isMyTurn && !marked && room.status === "playing";
                    return (
                      <Cell
                        key={n}
                        num={n}
                        marked={marked}
                        onBingoLine={bingoIndices.has(idx)}
                        clickable={clickable}
                        onClick={() => handleSelectCell(n)}
                      />
                    );
                  })}
                </div>

                {/* SVG Overlay for completed BINGO lines */}
                {completedLines.length > 0 && (
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-10 overflow-visible">
                    {completedLines.map((line, idx) => {
                      const coords = getLineCoordinates(line);
                      return (
                        <motion.line
                          key={idx}
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.1 }}
                          x1={coords.x1}
                          y1={coords.y1}
                          x2={coords.x2}
                          y2={coords.y2}
                          stroke="#fbbf24"
                          strokeWidth="5"
                          strokeLinecap="round"
                          className="drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>

              <div className="mt-3 text-center select-none">
                <div className="text-xs text-muted/80 leading-relaxed">
                  {room.status === "playing" ? (
                    isMyTurn ? (
                      <span className="font-semibold text-teal animate-pulse">
                        👉 Giliran Anda! Klik angka di papan Anda.
                      </span>
                    ) : (
                      <span>
                        ⏳ Menunggu {oppName ?? "lawan"} memanggil angka...
                      </span>
                    )
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {screen === "result" && room && board && (
            <motion.div key="result" {...fade}>
              <div className={`mb-6 rounded-3xl border p-6 text-center shadow-panel backdrop-blur-md ${
                iWon
                  ? "border-gold/30 bg-gold/5 text-gold"
                  : "border-rose/30 bg-rose/5 text-rose"
              }`}>
                <h2 className="mb-2 font-sans text-2xl font-black tracking-tight">
                  {iWon ? "🎉 Kemenangan Mutlak!" : "😅 Lawan Menang Duluan!"}
                </h2>
                <p className="text-[13px] text-ink/80 leading-relaxed font-medium">
                  {iWon
                    ? `Selamat! Anda berhasil mencapai 5 garis BINGO terlebih dahulu.`
                    : `${room.winner === "host" ? room.hostName : room.guestName} berhasil mencapai 5 garis BINGO lebih dulu.`}
                </p>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold text-muted select-none">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] tracking-wider text-muted/60 uppercase">Skor Anda</span>
                    <span className="text-xl font-mono text-ink mt-0.5">{myScore}</span>
                  </div>
                  <div className="h-8 w-px bg-line/65" />
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] tracking-wider text-muted/60 uppercase">Skor Lawan</span>
                    <span className="text-xl font-mono text-ink mt-0.5">{oppScore}</span>
                  </div>
                </div>
              </div>

              <div className="relative mb-6">
                <div className="grid grid-cols-5 gap-2.5 w-full aspect-square">
                  {board.map((n, idx) => (
                    <Cell
                      key={n}
                      num={n}
                      marked={drawnSet.has(n)}
                      onBingoLine={bingoIndices.has(idx)}
                    />
                  ))}
                </div>

                {/* SVG Overlay for completed BINGO lines */}
                {completedLines.length > 0 && (
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-10 overflow-visible">
                    {completedLines.map((line, idx) => {
                      const coords = getLineCoordinates(line);
                      return (
                        <motion.line
                          key={idx}
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.1 }}
                          x1={coords.x1}
                          y1={coords.y1}
                          x2={coords.x2}
                          y2={coords.y2}
                          stroke="#fbbf24"
                          strokeWidth="6"
                          strokeLinecap="round"
                          className="drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleNewGame}
                className="w-full rounded-xl bg-gradient-to-r from-indigo to-violet-600 hover:from-indigo-dark hover:to-violet-700 py-3.5 font-sans text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.25)] transition-all"
              >
                Main Lagi (Room Baru)
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
