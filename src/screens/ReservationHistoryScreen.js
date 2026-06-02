import React, { useEffect, useState } from "react";
import { Alert, Platform, View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ScreenLayout from "../components/ScreenLayout";

const parseDateToDisplay = (dateField) => {
  if (!dateField) return "";
  if (typeof dateField === "object" && (dateField.seconds || dateField._seconds)) {
    const secs = dateField.seconds || dateField._seconds;
    return new Date(secs * 1000).toLocaleDateString();
  }
  return String(dateField);
};

const parseTimeToDisplay = (timeField) => {
  if (!timeField) return "";
  // Handle Firestore Timestamp objects
  if (typeof timeField === "object" && (timeField.seconds || timeField._seconds)) {
    const secs = timeField.seconds || timeField._seconds;
    const date = new Date(secs * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  // Handle string times (HH:MM format)
  return String(timeField);
};

export default function ReservationHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleEdit = (reservation) => {
    navigation.navigate("Reservation", { editReservation: reservation });
  };

  const confirmDelete = async (reservationId) => {
    const doDelete = async () => {
      try {
        await deleteDoc(doc(db, "reservations", reservationId));
        setReservations((prev) => prev.filter((reservation) => reservation.id !== reservationId));
        if (Platform.OS === "web") {
          window.alert("Deleted: Booking removed successfully.");
        } else {
          Alert.alert("Deleted", "Booking removed successfully.");
        }
      } catch (error) {
        console.error("Reservation delete error:", error);
        Alert.alert("Delete failed", error.message || "Could not delete booking.");
      }
    };

    if (!reservationId) {
      Alert.alert("Delete failed", "Unable to identify the booking to delete.");
      return;
    }

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this reservation?")) {
        await doDelete();
      }
    } else {
      Alert.alert(
        "Delete booking",
        "Are you sure you want to delete this reservation?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ],
        { cancelable: true }
      );
    }
  };

  useEffect(() => {
    if (!user) {
      setReservations([]);
      setLoading(false);
      return;
    }

    const reservationsQuery = query(
      collection(db, "reservations"),
      where("userId", "==", user.uid),
    );

    const unsubscribe = onSnapshot(
      reservationsQuery,
      (snapshot) => {
        const items = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            if (a.date === b.date) {
              return (b.startTime || "").localeCompare(a.startTime || "");
            }
            return (b.date || "").localeCompare(a.date || "");
          });

        setReservations(items);
        setLoading(false);
      },
      (error) => {
        console.error("Reservation history listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const renderItem = ({ item }) => {
    const dateStr = parseDateToDisplay(item.date);
    const startTimeStr = parseTimeToDisplay(item.startTime);
    const endTimeStr = parseTimeToDisplay(item.endTime);
    const purposeStr = String(item.purpose || "").trim();
    const participantsStr = String(item.participants || "").trim();
    const requirementsStr = String(item.requirements || "").trim();
    const roomNameStr = String(item.roomName || item.roomId || "Room");
    const statusStr = String(item.status || "unknown").toUpperCase();

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <Text style={styles.roomName}>{roomNameStr}</Text>
          <View style={[styles.statusBadge, item.status === "approved" ? styles.approved : item.status === "pending" ? styles.pending : styles.rejected]}>
            <Text style={styles.statusText}>{statusStr}</Text>
          </View>
        </View>
        <Text style={styles.bookingLine}>{dateStr} • {startTimeStr} - {endTimeStr}</Text>
        {purposeStr ? <Text style={styles.bookingLine}>Purpose: {purposeStr}</Text> : null}
        {participantsStr ? <Text style={styles.bookingLine}>Participants: {participantsStr}</Text> : null}
        {requirementsStr ? <Text style={styles.bookingLine}>Requirements: {requirementsStr}</Text> : null}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.subActionButton, styles.editButton]} onPress={() => handleEdit(item)}>
            <Text style={styles.subActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.subActionButton, styles.deleteButton]} onPress={() => confirmDelete(item.id)}>
            <Text style={styles.subActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout navigation={navigation} active="History">
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <View style={styles.header}>
          <Text style={styles.title}>Booking History</Text>
          <Text style={styles.subtitle}>All of your room reservation requests are shown here.</Text>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading your bookings…</Text>
          </View>
        ) : reservations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No bookings yet.</Text>
            <Text style={styles.emptySubtext}>Tap below to make your first reservation.</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("Reservation")}> 
              <Text style={styles.actionButtonText}>Book a Room</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={reservations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 40,
  },
  bookingCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  roomName: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  approved: {
    backgroundColor: "#22c55e",
  },
  pending: {
    backgroundColor: "#f59e0b",
  },
  rejected: {
    backgroundColor: "#ef4444",
  },
  statusText: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "700",
  },
  bookingLine: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtext: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
  },
  actionButton: {
    marginTop: 10,
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  subActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 90,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#0ea5e9",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
    marginLeft: 10,
  },
  subActionText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});
