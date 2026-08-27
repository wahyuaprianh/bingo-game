export type Role = "host" | "guest";

export type Room = {
  code: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  status: "waiting" | "playing" | "finished";
  drawnNumbers: number[];
  currentTurn: Role;
  winner: Role | null;
  hostScore: number;
  guestScore: number;
};

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function genRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function genBoard(): number[] {
  return shuffle(Array.from({ length: 25 }, (_, i) => i + 1));
}

export function genPlayerId(): string {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

export function bingoLines(): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  lines.push([0, 6, 12, 18, 24]); // diagonal top-left to bottom-right
  lines.push([4, 8, 12, 16, 20]); // diagonal top-right to bottom-left
  return lines;
}

export function getCompletedLines(board: number[], drawnSet: Set<number>): number[][] {
  const marked = board.map((n) => drawnSet.has(n));
  const completed: number[][] = [];
  for (const line of bingoLines()) {
    if (line.every((idx) => marked[idx])) {
      completed.push(line);
    }
  }
  return completed;
}

export function checkBingo(board: number[], drawnSet: Set<number>): number[] | null {
  const completed = getCompletedLines(board, drawnSet);
  return completed.length > 0 ? completed[0] : null;
}
