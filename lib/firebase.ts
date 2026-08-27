import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * GANTI DENGAN CONFIG PROJECT FIREBASE KAMU SENDIRI.
 * Firebase Console > Project Settings > General > "Your apps" > Web app
 * > SDK setup and configuration.
 *
 * apiKey Firebase untuk web app memang publik/aman terlihat di browser —
 * yang menjaga keamanan datanya adalah Firestore Security Rules
 * (lihat README.md), bukan menyembunyikan apiKey ini.
 */
const firebaseConfig = {
  apiKey: "AIzaSyDYYDp3evUsatDMAcl9p3LRQ-z-0_OHFDY",
  authDomain: "bingo-game-187f7.firebaseapp.com",
  projectId: "bingo-game-187f7",
  storageBucket: "bingo-game-187f7.firebasestorage.app",
  messagingSenderId: "634037288965",
  appId: "1:634037288965:web:6352bbc74a3ca4d3045c6c",
  measurementId: "G-9004CL2W9Q"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
