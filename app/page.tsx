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
    <main className="flex min-h-screen items-start justify-center px-4 pb-16 pt-7">
      {screen !== "home" && (
        <div className="fixed right-3 top-3 z-40 rounded-full border border-line bg-bg-panel px-3 py-1 text-[10px] tracking-widest text-muted">
          <span className={connected ? "text-teal" : ""}>
            {connected ? "LIVE" : "MENGHUBUNGKAN..."}
          </span>
        </div>
      )}

      <Confetti show={screen === "result" && iWon} />

      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full font-display text-base font-bold text-[#3a2900] shadow-ball"
            style={{
              background: "radial-gradient(circle at 35% 30%, #fff5d0, #f2b705 55%, #c48f02 100%)"
            }}
          >
            B
          </div>
          <h1 className="bg-gradient-to-r from-gold to-coral bg-clip-text font-display text-2xl font-bold tracking-wide text-transparent">
            BINGO DUEL
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {screen === "home" && (
            <motion.div key="home" {...fade}>
              <div className="mb-4 rounded-3xl border border-line bg-gradient-to-b from-bg-panel to-bg-panel-2 p-6 shadow-panel">
                <div className="mb-1.5 text-[11px] uppercase tracking-[3px] text-teal">
                  Mulai Permainan
                </div>
                <h2 className="mb-1 font-display text-xl font-semibold">Siapa namamu?</h2>
                <p className="mb-5 text-[13px] leading-relaxed text-muted">
                  Buat room baru lalu bagikan kodenya, atau masukkan kode dari temanmu. Real-time,
                  bisa dimainkan di 2 perangkat berbeda.
                </p>

                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
                  Nama Pemain
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Wahyu"
                  className="mb-4 w-full rounded-xl border border-line bg-bg-deep px-3.5 py-3 text-[15px] tracking-wide text-ink outline-none focus:border-teal"
                />

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  className="w-full rounded-xl bg-gradient-to-r from-gold to-[#ffcf3d] py-3.5 font-display text-[15px] font-semibold text-[#3a2900] shadow-[0_6px_16px_rgba(242,183,5,0.28)]"
                >
                  Buat Room Baru
                </motion.button>

                <div className="my-5 flex items-center gap-3 text-[11px] tracking-widest text-muted">
                  <span className="h-px flex-1 bg-line" />
                  ATAU
                  <span className="h-px flex-1 bg-line" />
                </div>

                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
                  Kode Room
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="mis. K3J9P"
                  className="mb-4 w-full rounded-xl border border-line bg-bg-deep px-3.5 py-3 text-[15px] uppercase tracking-wide text-ink outline-none focus:border-teal"
                />

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleJoin}
                  className="w-full rounded-xl border-[1.5px] border-teal py-3.5 font-display text-[15px] font-semibold text-teal"
                >
                  Gabung ke Room
                </motion.button>

                {error && <div className="mt-3 text-center text-xs text-coral">{error}</div>}
              </div>
              <div className="text-center text-[11px] leading-relaxed text-muted">
                25 angka acak · garis horizontal, vertikal, atau diagonal = BINGO 🎉
              </div>
            </motion.div>
          )}

          {screen === "wait" && room && (
            <motion.div key="wait" {...fade}>
              <div className="rounded-3xl border border-line bg-gradient-to-b from-bg-panel to-bg-panel-2 p-6 shadow-panel">
                <div className="mb-1.5 text-[11px] uppercase tracking-[3px] text-teal">
                  Menunggu Lawan
                </div>
                <h2 className="mb-1 font-display text-xl font-semibold">Ajak temanmu main</h2>
                <p className="mb-5 text-[13px] leading-relaxed text-muted">
                  Bagikan kode room ini ke temanmu, ia buka link yang sama (boleh di HP/laptop
                  berbeda) lalu memasukkan kode ini.
                </p>

                <div className="mb-4 flex items-center justify-between rounded-2xl border-[1.5px] border-dashed border-gold-dark bg-bg-deep px-4.5 py-4">
                  <div>
                    <div className="text-[10px] tracking-widest text-muted">KODE ROOM</div>
                    <div className="font-display text-3xl font-bold tracking-[6px] text-gold">
                      {roomCode}
                    </div>
                  </div>
                  <button
                    onClick={copyCode}
                    className="rounded-lg border border-line bg-bg-panel-2 px-3 py-2 text-[11px] text-teal"
                  >
                    {copied ? "TERSALIN" : "SALIN"}
                  </button>
                </div>

                <div className="flex gap-2.5">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-bg-deep px-3 py-2.5 text-[13px]">
                    <div className="h-6 w-6 flex-shrink-0 rounded-full bg-teal" />
                    {room.hostName} (kamu)
                  </div>
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-line bg-bg-deep px-3 py-2.5 text-[13px] text-muted">
                    <div className="h-6 w-6 flex-shrink-0 rounded-full border-[1.5px] border-dashed border-line" />
                    Menunggu...
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2.5 text-[13px] text-muted">
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
                  className="mt-4.5 mt-5 w-full rounded-xl border border-dashed border-line py-3 text-[15px] font-display font-semibold text-muted"
                >
                  Batalkan
                </button>
              </div>
            </motion.div>
          )}

          {screen === "game" && room && board && (
            <motion.div key="game" {...fade}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
                <div
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-2 font-display text-[13px] font-semibold ${
                    isMyTurn
                      ? "border-teal/40 bg-teal/15 text-teal"
                      : "border-coral/35 bg-coral/10 text-coral"
                  }`}
                >
                  {isMyTurn ? "Giliranmu — pilih angka!" : `Giliran ${oppName ?? "lawan"}`}
                </div>
                <button
                  onClick={() => setSoundOn((s) => !s)}
                  className="rounded-lg border border-line px-3 py-2 text-[13px] text-muted"
                >
                  {soundOn ? "🔊 Suara: ON" : "🔇 Suara: OFF"}
                </button>
              </div>

              <div className="mb-3.5 flex items-center justify-between rounded-xl border border-line bg-bg-deep px-3.5 py-2.5 text-xs text-muted">
                <span>
                  Room <b className="text-ink">{roomCode}</b>
                </span>
                <span>
                  Lawan: <b className="text-ink">{oppName ?? "-"}</b>
                </span>
              </div>

              {/* Score Panel B-I-N-G-O */}
              <div className="mb-4.5 mb-5 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-gradient-to-b from-bg-panel to-bg-panel-2 p-4 shadow-panel text-center">
                {/* Kamu */}
                <div className="flex flex-col items-center border-r border-line pr-2">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-muted">BINGO KAMU</div>
                  <div className="flex gap-1">
                    {["B", "I", "N", "G", "O"].map((l, i) => {
                      const active = myScore > i;
                      return (
                        <span
                          key={l}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-bold transition-all ${
                            active
                              ? "bg-gradient-to-br from-gold to-gold-dark text-[#3a2900] shadow-[0_0_8px_rgba(242,183,5,0.5)] scale-105 animate-pulse"
                              : "border border-line bg-bg-deep text-muted/30"
                          }`}
                        >
                          {l}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted">
                    {myScore} dari 5 garis
                  </div>
                </div>

                {/* Lawan */}
                <div className="flex flex-col items-center pl-2">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-muted">
                    BINGO {oppName ? oppName.toUpperCase() : "LAWAN"}
                  </div>
                  <div className="flex gap-1">
                    {["B", "I", "N", "G", "O"].map((l, i) => {
                      const active = oppScore > i;
                      return (
                        <span
                          key={l}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-bold transition-all ${
                            active
                              ? "bg-gradient-to-br from-coral to-[#e14a3b] text-[#fff2ee] shadow-[0_0_8px_rgba(255,107,91,0.5)] scale-105 animate-pulse"
                              : "border border-line bg-bg-deep text-muted/30"
                          }`}
                        >
                          {l}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted">
                    {oppScore} dari 5 garis
                  </div>
                </div>
              </div>

              <div className="mb-4.5 mb-5 rounded-2xl border border-line bg-bg-deep p-4">
                <div className="mb-2.5 text-[10px] tracking-widest text-muted">
                  ANGKA YANG SUDAH DIPANGGIL ({room.drawnNumbers.length}/25)
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <AnimatePresence initial={false}>
                    {room.drawnNumbers.map((n, i) => (
                      <Ball key={n} num={n} latest={i === room.drawnNumbers.length - 1} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="mb-4.5 mb-5 grid grid-cols-5 gap-2">
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

              <div className="rounded-xl border border-dashed border-line bg-bg-deep/40 p-4 text-center">
                <div className="text-xs text-muted leading-relaxed">
                  {room.status === "playing" ? (
                    isMyTurn ? (
                      <span className="font-semibold text-teal">
                        👉 Giliranmu! Klik salah satu angka di atas yang belum ditandai untuk memanggilnya.
                      </span>
                    ) : (
                      <span>
                        ⏳ Menunggu {oppName ?? "lawan"} memilih angka berikutnya...
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
              <div className="mb-4 rounded-3xl border border-gold-dark bg-gradient-to-b from-gold/15 to-coral/10 p-6 text-center shadow-panel">
                <h2 className="mb-1.5 font-display text-2xl font-bold">
                  {iWon ? "🎉 BINGO! Kamu Menang!" : "😅 BINGO Lawan!"}
                </h2>
                <div className="text-[13px] text-muted">
                  {iWon
                    ? `Kerja bagus! Kamu mencapai 5 garis BINGO duluan. Skor akhir: ${myScore} - ${oppScore}`
                    : `${
                        room.winner === "host" ? room.hostName : room.guestName
                      } menyelesaikan 5 garis BINGO lebih dulu. Skor akhir: ${myScore} - ${oppScore}`}
                </div>
              </div>

              <div className="mb-5 grid grid-cols-5 gap-2">
                {board.map((n, idx) => (
                  <Cell
                    key={n}
                    num={n}
                    marked={drawnSet.has(n)}
                    onBingoLine={bingoIndices.has(idx)}
                  />
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleNewGame}
                className="w-full rounded-xl bg-gradient-to-r from-gold to-[#ffcf3d] py-3.5 font-display text-[15px] font-semibold text-[#3a2900] shadow-[0_6px_16px_rgba(242,183,5,0.28)]"
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
