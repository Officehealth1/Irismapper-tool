// Firebase configuration for Iris Mapper Pro
const firebaseConfig = {
  apiKey: "AIzaSyAg04Ucyyhh5b7K41iQD0z9VYBZZH5twok",
  authDomain: "irismapper-tool.firebaseapp.com",
  projectId: "irismapper-tool",
  storageBucket: "irismapper-tool.firebasestorage.app",
  messagingSenderId: "447533980369",
  appId: "1:447533980369:web:2116c5cb503cd5498c03f0",
  measurementId: "G-6H3DC9HCHB"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

console.log('Firebase initialized successfully');