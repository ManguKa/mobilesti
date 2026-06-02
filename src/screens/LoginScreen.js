import React, { useEffect, useState } from "react";
import { 
  Alert, 
  Platform, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithPopup } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";
// Ensure you have this installed: expo install @expo/vector-icons
import { Ionicons } from '@expo/vector-icons'; 

const STORAGE_KEYS = {
  email: "@roomfinder/rememberedEmail",
  rememberMe: "@roomfinder/rememberMe",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { theme } = useTheme();


  useEffect(() => {
    async function loadSavedCredentials() {
      try {
        const savedEmail = await AsyncStorage.getItem(STORAGE_KEYS.email);
        const savedRemember = await AsyncStorage.getItem(STORAGE_KEYS.rememberMe);
        if (savedEmail) {
          setEmail(savedEmail);
        }
        if (savedRemember === "true") {
          setRememberMe(true);
        }
      } catch (err) {
        console.error("Failed to load saved login info:", err);
      }
    }
    loadSavedCredentials();
  }, []);

  const clearError = () => setError("");

  const persistCredentials = async (shouldRemember, savedEmail) => {
    try {
      if (shouldRemember && savedEmail.trim()) {
        await AsyncStorage.setItem(STORAGE_KEYS.email, savedEmail.trim());
        await AsyncStorage.setItem(STORAGE_KEYS.rememberMe, "true");
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.email);
        await AsyncStorage.setItem(STORAGE_KEYS.rememberMe, "false");
      }
    } catch (err) {
      console.error("Failed to persist login preferences:", err);
    }
  };

  const handleLogin = async () => {
    clearError();
    if (!email.trim() || !password) {
      setError("Please enter a valid email and password.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await persistCredentials(rememberMe, email);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    clearError();

    if (Platform.OS !== "web") {
      Alert.alert(
        "Google Sign-In",
        "Google authentication is configured for web native popup in this fallback. For native iOS/Android, consider expo-auth-session or react-native-google-signin.",
      );
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePasswordReset = async () => {
    clearError();
    if (!email.trim()) {
      setError("Enter your email address to reset your password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Password Reset", "Password reset instructions have been sent to your email.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>STI</Text>
          </View>
        </View>

        {/* Header Text */}
        <Text style={styles.title}>Sign in to your account</Text>
        <Text style={styles.subtitle}>Access your classroom and reservations</Text>

        {/* Input Fields */}
        <View style={styles.formContainer}>
          
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#64748b"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color="#94a3b8" 
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.rowBetween}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={async () => {
                const nextValue = !rememberMe;
                setRememberMe(nextValue);
                await persistCredentials(nextValue, email);
              }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe ? <Ionicons name="checkmark" size={14} color="#0f172a" /> : null}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handlePasswordReset}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Buttons */}
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          {/* Swapped Microsoft button out for Google button */}
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={18} color="#ffffff" style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

        </View>

        {/* Footer */}
        <TouchableOpacity style={styles.footerContainer}>
          <Text style={styles.footerText}>Need help? Contact IT Support</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111827", 
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: 150,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: 'bold',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#1e293b", 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  eyeIcon: {
    padding: 10,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#475569",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: "#14b8a6", 
    borderColor: "#14b8a6",
  },
  rememberText: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  forgotText: {
    color: "#14b8a6", 
    fontSize: 14,
    fontWeight: "500",
  },
  error: {
    color: "#ef4444",
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: "#14b8a6", 
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  loginButtonText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  footerContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: "#64748b",
    fontSize: 13,
  },
});