# Bingo Duel — Next.js + React + Framer Motion + Firebase

Versi upgrade dari yang HTML statis: sekarang pakai React (Next.js App
Router) + Framer Motion untuk animasi (bola drop-in, cell pulse saat
ditandai, glow saat bingo, confetti saat menang), Tailwind untuk styling,
dan Firebase Firestore (`onSnapshot` realtime, bukan polling) untuk sync
2 pemain di 2 device.

## Struktur project

```
app/
  layout.tsx     -> font (Fredoka + Space Mono) & metadata
  page.tsx        -> seluruh UI & logic game (client component)
  globals.css      -> tailwind + keyframe custom (glow, pulse dot)
components/
  Ball.tsx        -> bola angka di "drum" riwayat panggilan (animasi drop)
  Cell.tsx        -> kotak papan bingo (animasi pulse saat ditandai)
  Confetti.tsx     -> efek confetti saat menang
lib/
  firebase.ts     -> init Firebase (ISI CONFIG DI SINI)
  game.ts         -> helper: acak papan, cek garis bingo, dll
  sound.ts        -> efek suara Web Audio API (tanpa file audio eksternal)
```

## 1. Isi config Firebase

Buka `lib/firebase.ts`, ganti:

```ts
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI.firebaseapp.com",
  projectId: "GANTI_PROJECT_ID",
  storageBucket: "GANTI.appspot.com",
  messagingSenderId: "GANTI_SENDER_ID",
  appId: "GANTI_APP_ID"
};
```

dengan config asli dari Firebase Console → Project Settings → Your apps →
Web app. (Langkah lengkap bikin project Firebase + Firestore + Security
Rules ada di bawah — sama seperti versi sebelumnya.)

### Bikin project Firebase (kalau belum)

1. https://console.firebase.google.com → **Add project**.
2. **Build → Firestore Database → Create database** → mode test dulu.
3. ⚙️ **Project settings → Your apps → </> (Web)** → register → salin
   `firebaseConfig`.
4. Di **Firestore Database → Rules**, pakai:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{roomId} {
         allow read: if true;
         allow create: if request.resource.data.keys().hasAll(
           ['code','hostId','hostName','status','drawOrder','drawnNumbers','currentTurn','winner']
         );
         allow update: if resource.data.status != 'finished' || request.resource.data.winner == resource.data.winner;
       }
     }
   }
   ```

   Klik **Publish**.

## 2. Jalankan lokal (opsional, untuk cek dulu)

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## 3. Deploy ke Vercel

**Lewat GitHub (disarankan):**
1. Push folder ini ke repo GitHub baru.
2. https://vercel.com → **Add New → Project** → import repo.
3. Next.js otomatis terdeteksi — tidak perlu ubah apa pun. Klik **Deploy**.

**Lewat CLI:**
```bash
npm i -g vercel
cd bingo-next
vercel        # preview
vercel --prod # production
```

## 4. Main berdua

Bagikan URL Vercel-nya. Satu buat room, satu masukkan kode room — dari
device manapun, selama buka URL yang sama.

## Catatan teknis

- Papan bingo pribadi (5x5, angka 1-25 acak) disimpan di `localStorage`
  browser masing-masing, **tidak** di Firestore — supaya tidak bocor ke
  lawan dan tetap ada saat refresh.
- Penarikan angka & klaim menang pakai `runTransaction` Firestore supaya
  aman dari race condition (mis. klik ganda / dua device menarik
  bersamaan).
- Semua animasi (bola drop, cell pulse, glow garis bingo, confetti) pakai
  Framer Motion — tidak ada library gambar/GIF eksternal.
- Efek suara pakai Web Audio API murni (oscillator), tidak ada file audio
  yang di-load, jadi tidak menambah bundle size.
