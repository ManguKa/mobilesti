import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext({
  user: null,
  role: "student",
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);

  const clearAuthStorage = () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("roomfinder.currentUser");
      }
    } catch (e) {
      // ignore localStorage failures on native
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          setRole(userData.role || "student");
          // Persist a copy of the authenticated user to browser localStorage for inspection (web only)
          try {
            if (typeof window !== "undefined" && window.localStorage) {
              const saved = {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName || "",
                email: firebaseUser.email || "",
                photoURL: firebaseUser.photoURL || null,
                role: userData.role || "student",
                savedAt: Date.now(),
              };
              window.localStorage.setItem("roomfinder.currentUser", JSON.stringify(saved));
            }
          } catch (e) {
            // ignore localStorage failures on native
          }
        } catch (error) {
          console.error("Failed to load user role:", error);
          setRole("student");
        }
      } else {
        clearAuthStorage();
        setRole("student");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthStorage();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage || !user) return;

    const watchStorage = async () => {
      try {
        const currentUserJson = window.localStorage.getItem("roomfinder.currentUser");
        if (!currentUserJson) {
          console.warn(
            "[RoomFinder] Detected localStorage removal from Chrome DevTools. Signing out user.",
          );
          await signOut(auth);
        }
      } catch (error) {
        console.error("Auth localStorage watcher error:", error);
      }
    };

    const intervalId = setInterval(watchStorage, 1000);
    return () => clearInterval(intervalId);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
