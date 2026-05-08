// 🔥 FIREBASE CONFIGURATION
// Follow setup instructions in README.md to get your config

const firebaseConfig = {
  apiKey: "AIzaSyCLZf14OnUei2bG7AGbNSGGp_YAKxAPF24",
  authDomain: "exptraciac.firebaseapp.com",
  projectId: "exptraciac",
  storageBucket: "exptraciac.firebasestorage.app",
  messagingSenderId: "472650772751",
  appId: "1:472650772751:web:2547c1de646d8f67ae0e7a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log("✅ Firebase initialized!");
