import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Image,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import ScreenLayout from "../components/ScreenLayout";

export default function ProfileScreen({ navigation }) {
  const { user, logout, role } = useAuth();
  const { theme, mode, setThemeMode } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(mode === "dark");
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 });

  useEffect(() => {
    setDisplayName(user?.displayName || "");
  }, [user]);

  useEffect(() => {
    setDarkModeEnabled(mode === "dark");
  }, [mode]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "reservations"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reservations = snapshot.docs.map((doc) => doc.data());
      setStats({
        total: reservations.length,
        approved: reservations.filter((item) => item.status === "approved").length,
        pending: reservations.filter((item) => item.status === "pending").length,
      });
    });
    return () => unsubscribe();
  }, [user]);

  const handleSave = async () => {
    setMessage("");
    setError("");

    if (!user) {
      setError("No authenticated user available.");
      return;
    }

    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }

    try {
      await updateProfile(user, {
        displayName: displayName.trim(),
      });
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleThemeChange = async (value) => {
    setDarkModeEnabled(value);
    await setThemeMode(value ? "dark" : "light");
  };

  return (
    <ScreenLayout navigation={navigation} active="Profile">
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>Personal details, account settings, and activity stats.</Text>

        <View style={[styles.profileHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>          
          <Image
            source={{ uri: user?.photoURL || "https://via.placeholder.com/120" }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>{user?.displayName || "User"}</Text>
            <Text style={[styles.profileEmail, { color: theme.subtext }]}>{user?.email}</Text>
            <View style={[styles.rolePill, { backgroundColor: theme.accent + "33" }]}>
              <Text style={[styles.roleText, { color: theme.accent }]}>{role ? role.charAt(0).toUpperCase() + role.slice(1) : "Student"}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>          
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Activity</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: theme.background, borderColor: theme.border }]}>              
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>Total Bookings</Text>
            </View>
            <View style={[styles.statItem, styles.statItemAccent, { backgroundColor: theme.background, borderColor: theme.border }]}>              
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.approved}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>Approved</Text>
            </View>
            <View style={[styles.statItem, styles.statItemPending, { backgroundColor: theme.background, borderColor: theme.border }]}>              
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.pending}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>Pending</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>          
          <Text style={[styles.cardTitle, { color: theme.text }]}>App Settings</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              thumbColor={notificationsEnabled ? theme.accent : theme.border}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Email Alerts</Text>
            <Switch
              value={emailAlertsEnabled}
              onValueChange={setEmailAlertsEnabled}
              thumbColor={emailAlertsEnabled ? theme.accent : theme.border}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
            <Switch
              value={darkModeEnabled}
              onValueChange={handleThemeChange}
              thumbColor={darkModeEnabled ? theme.accent : theme.border}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>          
          <Text style={[styles.cardTitle, { color: theme.text }]}>Edit Profile</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.panel, color: theme.text, borderColor: theme.border }]}
            placeholder="Display name"
            placeholderTextColor={theme.placeholder}
            value={displayName}
            onChangeText={setDisplayName}
          />
          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
          {message ? <Text style={[styles.success, { color: theme.accent }]}>{message}</Text> : null}
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={handleSave}>
            <Text style={[styles.primaryButtonText, { color: theme.safeArea }]}>Save Changes</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.cardTitle, { color: theme.text }]}>About STI RoomFinder</Text>
          <Text style={[styles.infoText, { color: theme.subtext }]}>Version 1.0.0</Text>
          <Text style={[styles.infoText, { color: theme.subtext }]}>Real-Time Classroom Tracker and Booking System</Text>
          <Text style={[styles.infoText, { color: theme.subtext }]}>© 2026 STI. All rights reserved.</Text>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.card, borderColor: theme.danger }]} onPress={logout}>
          <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: 22,
    fontSize: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  profileEmail: {
    color: "#94a3b8",
    marginBottom: 10,
  },
  rolePill: {
    backgroundColor: "rgba(20, 184, 166, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  roleText: {
    color: "#14b8a6",
    fontWeight: "700",
    fontSize: 12,
  },
  statsCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    color: "#ffffff",
    fontWeight: "700",
    marginBottom: 14,
    fontSize: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
  },
  statItemAccent: {
    backgroundColor: "#0f172a",
  },
  statItemPending: {
    backgroundColor: "#0f172a",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  infoText: {
    color: "#cbd5e1",
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingLabel: {
    color: "#ffffff",
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  input: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  error: {
    color: "#f87171",
    marginBottom: 12,
  },
  success: {
    color: "#34d399",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#14b8a6",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "700",
  },
});