import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView } from "react-native";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { generateAllRooms, getRoomStatusByKey } from "../data/RoomDefs";
import ScreenLayout from "../components/ScreenLayout";

// Helper function to safely parse dates for sorting and filtering (YYYY-MM-DD format)
const parseDateToString = (dateField) => {
  if (!dateField) return "";
  if (typeof dateField === "object" && (dateField.seconds || dateField._seconds)) {
    const secs = dateField.seconds || dateField._seconds;
    return new Date(secs * 1000).toISOString().slice(0, 10);
  }
  return String(dateField);
};

// Helper function to safely parse dates for user display
const parseDateToDisplay = (dateField) => {
  if (!dateField) return "";
  if (typeof dateField === "object" && (dateField.seconds || dateField._seconds)) {
    const secs = dateField.seconds || dateField._seconds;
    return new Date(secs * 1000).toLocaleDateString();
  }
  return String(dateField);
};

export default function DashboardScreen({ navigation }) {
  const { user, role } = useAuth();
  const { theme } = useTheme();
  const [reservations, setReservations] = useState([]);
  const [roomStats, setRoomStats] = useState({ available: 0, occupied: 0, reserved: 0, bookedToday: 0 });
  const [upcomingBooking, setUpcomingBooking] = useState(null);
  const rooms = useMemo(() => generateAllRooms(), []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "reservations"),
      where("userId", "==", user.uid),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReservations(items);

      const upcoming = items
        .filter((item) => item.status !== "rejected")
        .sort((a, b) => {
          const dateA = parseDateToString(a.date);
          const dateB = parseDateToString(b.date);
          if (dateA === dateB) {
            return (a.startTime || "").localeCompare(b.startTime || "");
          }
          return dateA.localeCompare(dateB);
        })
        .find((item) => parseDateToString(item.date) >= new Date().toISOString().slice(0, 10));

      setUpcomingBooking(upcoming || null);
    }, (error) => {
      console.error("Dashboard listener error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const available = rooms.filter((room) => getRoomStatusByKey(room.roomNumber, reservations, rooms) === "available").length;
    const occupied = rooms.filter((room) => getRoomStatusByKey(room.roomNumber, reservations, rooms) === "occupied").length;
    const reserved = rooms.filter((room) => getRoomStatusByKey(room.roomNumber, reservations, rooms) === "reserved").length;
    const bookedToday = reservations.filter(
      (item) => item.status === "approved" && parseDateToString(item.date) === todayKey,
    ).length;

    setRoomStats({ available, occupied, reserved, bookedToday });
  }, [reservations, rooms]);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  // NOTE: If your navigator file uses a different screen name, change "History" below to match it exactly.
  const actions = [
    { label: "Book a Room", route: "Reservation", description: "Start a new booking" },
    { label: "My Bookings", route: "History", description: "Review your requests" },
    { label: "Room Status", route: "RoomStatus", description: "See live room availability" },
    { label: "3D Building Map", route: "Viewer3D", description: "Explore available rooms" },
  ];

  if (role === "approver" || role === "admin") {
    actions.push({ label: "Approvals", route: "Approvals", description: "Review pending requests" });
  }

  const cards = [
    { label: "Available", value: roomStats.available, color: "#16a34a" },
    { label: "Occupied", value: roomStats.occupied, color: "#ef4444" },
    { label: "Reserved", value: roomStats.reserved, color: "#f59e0b" },
    { label: "Booked Today", value: roomStats.bookedToday, color: "#0ea5e9" },
  ];

  return (
    <ScreenLayout navigation={navigation} active="Dashboard">
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Welcome back,</Text>
          <Text style={styles.heroName}>{displayName} 👋</Text>
          <Text style={styles.heroSubtitle}>Have a great day at STI</Text>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Book</Text>
        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.route)}
            >
                  <View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.upcomingSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.subSectionTitle}>Upcoming Booking</Text>
            <TouchableOpacity onPress={() => navigation.navigate("History")}>
              <Text style={styles.viewAll}>View all →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.upcomingCard}>
            {upcomingBooking ? (
              <View style={styles.upcomingContent}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.upcomingRoom}>{upcomingBooking.roomName || "Room"}</Text>
                  <Text style={styles.upcomingMeta}>
                    {parseDateToDisplay(upcomingBooking.date)} • {upcomingBooking.startTime} - {upcomingBooking.endTime}
                  </Text>
                </View>
                <View style={[styles.upcomingStatusBadge, upcomingBooking.status === "approved" ? styles.statusConfirmed : styles.statusPending]}>
                  <Text style={styles.upcomingStatusText}>{upcomingBooking.status === "approved" ? "Confirmed" : "Pending"}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.upcomingEmpty}>No upcoming bookings found.</Text>
            )}
          </View>
        </View>

        {/* Room Status Statistics */}
        <Text style={styles.sectionTitle}>Room Status</Text>
        <FlatList
          data={cards}
          keyExtractor={(item) => item.label}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
          renderItem={({ item }) => (
            <View style={[styles.statCard, { borderColor: item.color }]}> 
              <View style={[styles.statIcon, { backgroundColor: item.color + "20" }]}>
                <Text style={[styles.statIconText, { color: item.color }]}>•</Text>
              </View>
              <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          )}
        />
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
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: "#0f766e",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroTitle: {
    color: "rgba(240, 249, 255, 0.8)",
    fontSize: 16,
    marginBottom: 6,
  },
  heroName: {
    color: "#e0fdf4",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "rgba(226, 240, 255, 0.75)",
    fontSize: 14,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  subSectionTitle: {
    color: "#cbd5e1",
    fontSize: 18,
    fontWeight: "700",
  },
  viewAll: {
    color: "#14b8a6",
    fontSize: 13,
  },
  upcomingSection: {
    marginBottom: 24,
  },
  upcomingCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  upcomingContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upcomingRoom: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  upcomingMeta: {
    color: "#94a3b8",
    fontSize: 14,
  },
  upcomingStatusBadge: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statusConfirmed: {
    backgroundColor: "#134e4a",
  },
  statusPending: {
    backgroundColor: "#78350f",
  },
  upcomingStatusText: {
    color: "#e2e8f0",
    fontWeight: "700",
  },
  upcomingEmpty: {
    color: "#cbd5e1",
  },
  actionCard: {
    backgroundColor: "#111827",
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 18,
    width: "48%",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#17303f",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(20, 184, 166, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  actionIconText: {
    color: "#14b8a6",
    fontSize: 26,
  },
  actionLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionDescription: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statsRow: {
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    width: 160,
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statIconText: {
    fontSize: 24,
    lineHeight: 28,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  statLabel: {
    color: "#cbd5e1",
  },
});