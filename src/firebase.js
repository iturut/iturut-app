import { initializeApp } from "firebase/app";
import { getAuth, signOut, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyADMe0qyQHtXRcc4_5Ph9_u54lpAZ38zn0",
  authDomain: "iturutnotes.firebaseapp.com",
  projectId: "iturutnotes",
  storageBucket: "iturutnotes.appspot.com",
  messagingSenderId: "297342013490",
  appId: "1:297342013490:web:085079b128f4a059baac2b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signOut, onAuthStateChanged, signInWithEmailAndPassword, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy };