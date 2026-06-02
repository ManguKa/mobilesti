import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { generateAllRooms } from "../data/RoomDefs";
import ScreenLayout from "../components/ScreenLayout";

function parseTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

function formatTime(value) {
  return value.toTimeString().slice(0, 5);
}

function parseDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00`);
}

export default function ReservationScreen({ navigation, route }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [roomId, setRoomId] = useState("");
  const [reservationDate, setReservationDate] = useState(new Date());
  const [startDateTime, setStartDateTime] = useState(() => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [endDateTime, setEndDateTime] = useState(() => {
    const date = new Date();
    date.setHours(10, 0, 0, 0);
    return date;
  });
  const [duration, setDuration] = useState("1 hour");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [participants, setParticipants] = useState("1");
  const [requirements, setRequirements] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const rooms = useMemo(() => generateAllRooms(), []);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const selectedRoom = rooms.find((room) => room.id === roomId);

  useEffect(() => {
    const { roomId: requestedRoomId, editReservation } = route?.params || {};

    if (editReservation) {
      setIsEditing(true);
      setEditingReservationId(editReservation.id);
      setRoomId(editReservation.roomId || "");
      setReservationDate(parseDate(editReservation.date));
      setStartDateTime(parseTime(editReservation.startTime));
      setEndDateTime(parseTime(editReservation.endTime));
      setPurpose(editReservation.purpose || "");
      setParticipants(String(editReservation.participants || 1));
      setRequirements(editReservation.requirements || "");
      setError("");
      setSuccess("");
      return;
    }

    if (requestedRoomId) {
      setRoomId(requestedRoomId);
    }
  }, [route?.params]);

  useEffect(() => {
    if (!roomId && rooms.length > 0) {
      setRoomId(rooms[0].id);
    }
  }, [rooms, roomId]);

  useEffect(() => {
    if (!startDateTime || !endDateTime) {
      setDuration("1 hour");
      return;
    }

    const diff = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    const rounded = diff > 0 ? `${Math.max(1, Math.round(diff * 2) / 2)} hour${Math.abs(diff - 1) < 0.1 ? "" : "s"}` : "1 hour";
    setDuration(rounded);
  }, [startDateTime, endDateTime]);

  const validateForm = () => {
    if (!roomId) {
      setError("Please select a room.");
      return false;
    }
    if (!reservationDate) {
      setError("Please select a reservation date.");
      return false;
    }
    if (!startDateTime || !endDateTime || startDateTime >= endDateTime) {
      setError("Please enter a valid start and end time.");
      return false;
    }
    if (!purpose.trim()) {
      setError("Please enter the purpose of your reservation.");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!validateForm()) return;

    if (!user) {
      setError("Please sign in to submit a reservation.");
      return;
    }

    try {
      setLoading(true);
      const room = rooms.find((item) => item.id === roomId);
      const dateValue = formatDate(reservationDate);
      const startValue = formatTime(startDateTime);
      const endValue = formatTime(endDateTime);

      // Query for all reservations on this room and date
      const reservationsQuery = query(
        collection(db, "reservations"),
        where("roomId", "==", roomId),
        where("date", "==", dateValue),
      );
      const snapshot = await getDocs(reservationsQuery);
      
      const overlapping = snapshot.docs.some((docSnapshot) => {
        // 1. Exclude the current reservation if we are editing it
        if (isEditing && docSnapshot.id === editingReservationId) return false;

        const data = docSnapshot.data();
        
        // 2. Ignore rejected or cancelled reservations
        if (data.status === "rejected" || data.status === "cancelled") return false;

        const existingStart = parseTime(data.startTime);
        const existingEnd = parseTime(data.endTime);
        if (!existingStart || !existingEnd) return false;

        // 3. Convert times to total minutes from midnight for accurate comparison
        const currentStartMins = startDateTime.getHours() * 60 + startDateTime.getMinutes();
        const currentEndMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
        const existStartMins = existingStart.getHours() * 60 + existingStart.getMinutes();
        const existEndMins = existingEnd.getHours() * 60 + existingEnd.getMinutes();

        // 4. Standard Overlap Condition: (Start A < End B) and (End A > Start B)
        return currentStartMins < existEndMins && currentEndMins > existStartMins;
      });

      if (overlapping) {
        setError("This room is already booked for the selected date and time.");
        return;
      }

      const reservationData = {
        roomId,
        roomName: room?.roomName || "Room",
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userEmail: user.email,
        date: dateValue,
        startTime: startValue,
        endTime: endValue,
        purpose: purpose.trim(),
        participants: Number(participants) || 1,
        requirements: requirements.trim(),
        status: "pending",
        updatedAt: serverTimestamp(), // Useful for ordering later
      };

      // Add a client timestamp for internal ordering (serverTimestamp isn't serializable)
      reservationData.clientSavedAt = Date.now();

      if (isEditing && editingReservationId) {
        await updateDoc(doc(db, "reservations", editingReservationId), reservationData);
        setSuccess("Reservation updated successfully.");
      } else {
        reservationData.createdAt = serverTimestamp();
        await addDoc(collection(db, "reservations"), reservationData);
        setSuccess("Reservation submitted successfully.");
      }

      // Reset form on success
      setPurpose("");
      setRequirements("");
      setParticipants("1");
      setIsEditing(false);
      setEditingReservationId(null);
      navigation.navigate("History");
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingReservationId(null);
    navigation.goBack();
  };

  return (
    <ScreenLayout navigation={navigation} active="Reservation">
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEditing ? "Update Reservation" : "Book a Room"}</Text>
      <Text style={styles.subtitle}>Select a room and schedule your reservation.</Text>

      <Text style={styles.label}>Room</Text>
      {!showRoomPicker ? (
        <View style={styles.selectedRoomCompact}>
          {selectedRoom ? (
            <View style={[styles.roomCard, styles.compactRoomCard]}>
              <Text style={styles.roomName}>{selectedRoom.roomNumber}</Text>
              <Text style={styles.roomMeta}>{selectedRoom.roomName}</Text>
              <Text style={styles.roomMeta}>{selectedRoom.building} - Floor {selectedRoom.floor}</Text>
              <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={() => setShowRoomPicker(true)}>
                <Text style={styles.secondaryButtonText}>Choose Different Room</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.roomCard, styles.compactRoomCard]} onPress={() => setShowRoomPicker(true)}>
              <Text style={styles.roomName}>Select a room</Text>
              <Text style={styles.roomMeta}>Tap to choose from the list</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.roomsContainer}>
            {rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomCard, roomId === room.id && styles.roomSelected]}
                onPress={() => { setRoomId(room.id); setShowRoomPicker(false); }}
              >
                <Text style={styles.roomName}>{room.roomNumber}</Text>
                <Text style={styles.roomMeta}>{room.roomName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowRoomPicker(false)}>
            <Text style={styles.secondaryButtonText}>Hide Rooms</Text>
          </TouchableOpacity>
        </>
      )}

      {selectedRoom ? (
        <View style={styles.roomInfoCard}>
          <Text style={styles.roomInfoTitle}>{selectedRoom.roomName}</Text>
          <Text style={styles.roomInfoText}>{selectedRoom.building} - Floor {selectedRoom.floor} - Capacity {selectedRoom.capacity}</Text>
          <Text style={styles.roomInfoText}>{selectedRoom.roomDescription || "Flexible space for classes and meetings."}</Text>
          <Text style={styles.roomInfoBadge}>Estimated duration: {duration}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.pickerButton}>
        <Text style={styles.pickerText}>{formatDate(reservationDate)}</Text>
      </TouchableOpacity>

      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.label}>Start Time</Text>
          <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.pickerButton}>
            <Text style={styles.pickerText}>{formatTime(startDateTime)}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.pickerButton}>
            <Text style={styles.pickerText}>{formatTime(endDateTime)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          testID="datePicker"
          value={reservationDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selectedDate) {
              setReservationDate(selectedDate);
            }
          }}
        />
      )}
      {showStartPicker && (
        <DateTimePicker
          testID="startTimePicker"
          value={startDateTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedTime) => {
            setShowStartPicker(Platform.OS === "ios");
            if (selectedTime) {
              setStartDateTime(selectedTime);
            }
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          testID="endTimePicker"
          value={endDateTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedTime) => {
            setShowEndPicker(Platform.OS === "ios");
            if (selectedTime) {
              setEndDateTime(selectedTime);
            }
          }}
        />
      )}

      <Text style={styles.label}>Purpose</Text>
      <TextInput
        style={styles.input}
        placeholder="Meeting, study session, class, etc."
        placeholderTextColor="#94a3b8"
        value={purpose}
        onChangeText={setPurpose}
      />

      <Text style={styles.label}>Participants</Text>
      <TextInput
        style={styles.input}
        placeholder="Number of attendees"
        placeholderTextColor="#94a3b8"
        keyboardType="numeric"
        value={participants}
        onChangeText={setParticipants}
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Room setup, equipment, reminders..."
        placeholderTextColor="#94a3b8"
        value={requirements}
        onChangeText={setRequirements}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Submitting..." : isEditing ? "Update Reservation" : "Submit Reservation"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={isEditing ? cancelEdit : () => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>{isEditing ? "Cancel Edit" : "Back to Dashboard"}</Text>
      </TouchableOpacity>
    </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 24 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#94a3b8", marginBottom: 20, fontSize: 16 },
  label: { color: "#cbd5e1", marginBottom: 8, marginTop: 12 },
  roomsContainer: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  roomCard: { width: "48%", backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 12, marginHorizontal: 6 },
  roomSelected: { borderColor: "#14b8a6", borderWidth: 2 },
  roomName: { color: "#ffffff", fontWeight: "700", marginBottom: 6 },
  roomMeta: { color: "#94a3b8", fontSize: 12 },
  roomInfoCard: { backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 20 },
  roomInfoTitle: { color: "#ffffff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  roomInfoText: { color: "#cbd5e1", marginBottom: 6 },
  roomInfoBadge: { color: "#14b8a6", fontWeight: "700", marginTop: 8 },
  input: { backgroundColor: "#1e293b", color: "#ffffff", borderRadius: 12, padding: 14, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeBlock: { flex: 1 },
  pickerButton: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 12 },
  pickerText: { color: "#ffffff", fontSize: 16 },
  error: { color: "#f87171", marginBottom: 12 },
  success: { color: "#34d399", marginBottom: 12 },
  button: { backgroundColor: "#14b8a6", borderRadius: 14, padding: 18, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  secondaryButton: { borderColor: "#14b8a6", borderWidth: 1, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 12 },
  secondaryButtonText: { color: "#14b8a6", fontWeight: "700" },
});