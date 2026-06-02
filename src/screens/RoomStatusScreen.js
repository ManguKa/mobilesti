import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { db } from "../firebase/firebaseConfig";
import { collection, onSnapshot, query } from "firebase/firestore";
import { mergeRoomsWithDefaults, getRoomStatusByKey } from "../data/RoomDefs";
import { useTheme } from "../context/ThemeContext";
import ScreenLayout from "../components/ScreenLayout";

export default function RoomStatusScreen({ navigation }) {
  const { theme } = useTheme();
  const [dbRooms, setDbRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts, setCounts] = useState({ available: 0, reserved: 0, occupied: 0 });

  // Process and merge live Firestore rooms with default layout definitions
  const rooms = useMemo(() => {
    return mergeRoomsWithDefaults(dbRooms);
  }, [dbRooms]);

  // Real-time synchronization for both rooms and reservations collections
  useEffect(() => {
    const roomsQuery = query(collection(db, "rooms"));
    const unsubscribeRooms = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const roomsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDbRooms(roomsData);
      },
      (err) => console.error("Rooms subscription error:", err)
    );

    const reservationsQuery = query(collection(db, "reservations"));
    const unsubscribeReservations = onSnapshot(
      reservationsQuery,
      (snapshot) => {
        setReservations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => console.error("Reservations subscription error:", err)
    );

    return () => {
      unsubscribeRooms();
      unsubscribeReservations();
    };
  }, []);

  // Recalculate badge metrics when database state adjusts
  useEffect(() => {
    const newCounts = { available: 0, reserved: 0, occupied: 0 };
    rooms.forEach((room) => {
      const status = getRoomStatusByKey(room.roomNumber || room.id, reservations, rooms);
      if (newCounts[status] !== undefined) {
        newCounts[status]++;
      }
    });
    setCounts(newCounts);
  }, [rooms, reservations]);

  // Unified Search and Selector Filtration
  const filteredRooms = rooms.filter((room) => {
    const validFloor = room.floor >= 1 && room.floor <= 4;
    const normalizedSearch = search.trim().toLowerCase();
    const status = getRoomStatusByKey(room.roomNumber || room.id, reservations, rooms);

    const matchSearch =
      !normalizedSearch ||
      room.roomName?.toLowerCase().includes(normalizedSearch) ||
      room.roomNumber?.toString().toLowerCase().includes(normalizedSearch);

    const matchFloor = !floorFilter || room.floor?.toString() === floorFilter;
    const matchStatus = statusFilter === "all" || status === statusFilter;

    return validFloor && matchSearch && matchFloor && matchStatus;
  });

  // Group rooms by target Floor designation
  const groupedRooms = filteredRooms.reduce((groups, room) => {
    const floor = room.floor || "Unknown";
    if (!groups[floor]) groups[floor] = [];
    groups[floor].push(room);
    return groups;
  }, {});

  const statusPillColor = (status) => {
    if (status === "available") return "#16a34a";
    if (status === "reserved") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <ScreenLayout navigation={navigation} active="RoomStatus">
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Room Status</Text>
        <Text style={styles.subtitle}>Live room availability and reservation status.</Text>
        
        <TouchableOpacity style={styles.viewerButton} onPress={() => navigation.navigate('Viewer3D')}>
          <Text style={styles.viewerButtonText}>Open 3D Building Map</Text>
        </TouchableOpacity>

        {/* Legend Indicator Section */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
            <Text style={styles.legendText}>Reserved</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={styles.legendText}>Occupied</Text>
          </View>
        </View>

        {/* Real-time Status Counter Metrics */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Available</Text>
            <Text style={styles.statValue}>{counts.available}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Reserved</Text>
            <Text style={styles.statValue}>{counts.reserved}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Occupied</Text>
            <Text style={styles.statValue}>{counts.occupied}</Text>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />

        {/* Floor Context Filtering Row */}
        <View style={styles.filterRow}>
          {['', '1', '2', '3', '4'].map((floor) => (
            <TouchableOpacity
              key={floor}
              style={[styles.filterButton, floorFilter === floor && styles.filterButtonActive]}
              onPress={() => setFloorFilter(floor)}
            >
              <Text style={styles.filterButtonText}>{floor ? `Floor ${floor}` : 'All Floors'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Availability Status Filtering Row */}
        <View style={styles.filterRow}>
          {['all', 'available', 'reserved', 'occupied'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, statusFilter === status && styles.filterButtonActive]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={styles.filterButtonText}>
                {status === 'all' ? 'All Room Types' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dynamic Rooms Grid Layout Container */}
        {Object.keys(groupedRooms).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rooms match your filter.</Text>
          </View>
        ) : (
          Object.keys(groupedRooms)
            .sort()
            .map((floor) => (
              <View key={floor} style={styles.floorSection}>
                <Text style={styles.floorHeading}>Floor {floor}</Text>
                <View style={styles.roomGrid}>
                  {groupedRooms[floor].map((room) => {
                    const status = getRoomStatusByKey(room.roomNumber || room.id, reservations, rooms);
                    return (
                      <TouchableOpacity
                        key={room.id}
                        style={styles.roomCard}
                        onPress={() => navigation.navigate('Reservation', { roomId: room.id })}
                      >
                        <View style={styles.roomCardHeader}>
                          <Text style={styles.roomNumber}>
                            {room.roomName || room.roomNumber || room.id}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusPillColor(status) }]}>
                            <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={styles.roomName}>
                          {room.roomNumber ? "Room " + room.roomNumber : ""}
                        </Text>
                        <Text style={styles.roomMeta}>
                          CICT BUILDING • {room.floor ? "Floor " + room.floor : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: '#ffffff', fontSize: 26, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#94a3b8', marginBottom: 16, fontSize: 15 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { color: '#cbd5e1', fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14, marginRight: 8 },
  statLabel: { color: '#94a3b8', marginBottom: 8, fontSize: 12 },
  statValue: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  searchInput: { backgroundColor: '#111827', color: '#ffffff', borderRadius: 14, padding: 14, marginBottom: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#111827', marginRight: 8, marginBottom: 8 },
  filterButtonActive: { backgroundColor: '#14b8a6' },
  filterButtonText: { color: '#ffffff', fontWeight: '600' },
  viewerButton: { backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16, alignSelf: 'flex-start' },
  viewerButtonText: { color: '#ffffff', fontWeight: '700' },
  emptyState: { backgroundColor: '#111827', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
  floorSection: { marginBottom: 24 },
  floorHeading: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  roomCard: { width: '48%', backgroundColor: '#111827', borderRadius: 16, padding: 14, marginBottom: 12 },
  roomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  roomNumber: { color: '#ffffff', fontWeight: '700', fontSize: 13, flex: 1, flexWrap: 'wrap', marginRight: 4 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { color: '#0f172a', fontWeight: '700', fontSize: 9 },
  roomName: { color: '#cbd5e1', marginBottom: 6, fontSize: 14 },
  roomMeta: { color: '#94a3b8', fontSize: 11 },
});