// ============================================================
//  FIREBASE CONFIGURATION
//  Replace the placeholder values below with your own Firebase
//  project credentials. See README.md for step-by-step setup.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCQnrQQNm19-Vov0eyeKR11p1SzJThH42o",
  authDomain: "geotrack-e8d72.firebaseapp.com",
  projectId: "geotrack-e8d72",
  storageBucket: "geotrack-e8d72.firebasestorage.app",
  messagingSenderId: "446590499401",
  appId: "1:446590499401:web:94813769c6b56ff5d51d98",
  measurementId: "G-CVRPNNK112"
};

// ── Initialize Firebase ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── Helper: detect if config is still placeholder ────────────
function isConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" &&
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}
