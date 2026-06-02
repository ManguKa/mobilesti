import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBUT8olDOvPmR5Gv_07aho83CpJFzkxSdg",
  authDomain: "snack-5d9dd.firebaseapp.com",
  projectId: "snack-5d9dd",
  storageBucket: "snack-5d9dd.appspot.com",
  messagingSenderId: "883964631489",
  appId: "1:883964631489:web:aede16766456f82bca3740",
  measurementId: "G-3XHK70T7JH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
