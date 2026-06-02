import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import ScreenLayout from "../components/ScreenLayout";

export default function ApprovalScreen({ navigation }) {
  const { user, role, loading } = useAuth();
  const { theme } = useTheme();
  const [requests, setRequests] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [counts, setCounts] = useState({ pending: 0 });
  const [todayCounts, setTodayCounts] = useState({ approved: 0, rejected: 0 });
  const [listening, setListening] = useState(false);

  const isApprover = role === "approver" || role === "admin";

  useEffect(() => {
    if (!user || loading || !isApprover) {
      setRequests([]);
      setListening(false);
      return;
    }

    const q = query(collection(db, "reservations"), where("status", "==", selectedStatus));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRequests(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setListening(true);
      },
      (err) => {
        console.error("Approvals listen error:", err);
        setRequests([]);
        setListening(false);
      }
    );

    return () => unsubscribe();
  }, [user, role, loading, isApprover, selectedStatus]);

  useEffect(() => {
    if (!user || loading || !isApprover) {
      setCounts({ pending: 0 });
      setTodayCounts({ approved: 0, rejected: 0 });
      return;
    }

    const today = new Date().toDateString();
    const pendingQ = query(collection(db, "reservations"), where("status", "==", "pending"));
    const approvedQ = query(collection(db, "reservations"), where("status", "==", "approved"));
    const rejectedQ = query(collection(db, "reservations"), where("status", "==", "rejected"));

    const unsubPending = onSnapshot(pendingQ, (snap) => setCounts({ pending: snap.docs.length }));
    const unsubApproved = onSnapshot(approvedQ, (snap) => {
      const approvedToday = snap.docs.filter((doc) => {
        const data = doc.data();
        const ts = data.approvedAt || data.createdAt;
        const date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
        return date?.toDateString() === today;
      }).length;
      setTodayCounts((prev) => ({ ...prev, approved: approvedToday }));
    });
    const unsubRejected = onSnapshot(rejectedQ, (snap) => {
      const rejectedToday = snap.docs.filter((doc) => {
        const data = doc.data();
        const ts = data.rejectedAt || data.createdAt;
        const date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
        return date?.toDateString() === today;
      }).length;
      setTodayCounts((prev) => ({ ...prev, rejected: rejectedToday }));
    });

    return () => {
      unsubPending();
      unsubApproved();
      unsubRejected();
    };
  }, [user, role, loading, isApprover]);

  const handleDecision = async (id, decision) => {
    if (!isApprover) {
      Alert.alert("Access Denied", "You are not authorized to approve requests.");
      return;
    }

    try {
      const updateData = {
        status: decision,
      };
      if (decision === "approved") {
        updateData.approvedAt = serverTimestamp();
      } else if (decision === "rejected") {
        updateData.rejectedAt = serverTimestamp();
      }
      await updateDoc(doc(db, "reservations", id), updateData);
    } catch (err) {
      Alert.alert("Error", err.message || "Unable to update request");
    }
  };

  if (loading) {
    return (
      <ScreenLayout navigation={navigation} active="Approvals">
        <View style={[styles.container, { backgroundColor: theme.background }]}>          
          <Text style={styles.title}>Approvals</Text>
          <Text style={styles.info}>Loading user access...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!user) {
    return (
      <ScreenLayout navigation={navigation} active="Approvals">
        <View style={[styles.container, { backgroundColor: theme.background }]}>          
          <Text style={styles.title}>Approvals</Text>
          <Text style={styles.info}>Sign in to view approvals.</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!isApprover) {
    return (
      <ScreenLayout navigation={navigation} active="Approvals">
        <View style={[styles.container, { backgroundColor: theme.background }]}>          
          <Text style={styles.title}>Approvals</Text>
          <Text style={styles.info}>Access denied. This section is only available to approvers.</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation} active="Approvals">
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Approvals</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending Approvals</Text>
          <Text style={styles.statValue}>{counts.pending}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Approved Today</Text>
          <Text style={styles.statValue}>{todayCounts.approved}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Rejected Today</Text>
          <Text style={styles.statValue}>{todayCounts.rejected}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {['pending', 'approved', 'rejected'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, selectedStatus === status && styles.filterButtonActive]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text style={styles.filterButtonText}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.info}>{listening ? `No ${selectedStatus} requests` : 'Loading requests...'}</Text>
        </View>
      ) : (
        requests.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.room}>{item.roomName || 'Room'}</Text>
                <Text style={styles.meta}>{item.userName || item.userEmail}</Text>
              </View>
              <Text style={[styles.statusTag, item.status === 'approved' ? styles.approvedTag : item.status === 'rejected' ? styles.rejectedTag : styles.pendingTag]}>
                {item.status.toUpperCase()}
              </Text>
            </View>

            <Text style={styles.purpose}>{item.date} - {item.startTime} - {item.endTime}</Text>
            <Text style={styles.details}>{item.purpose || 'No purpose provided'}</Text>
            {item.requirements ? <Text style={styles.details}>Notes: {item.requirements}</Text> : null}

            {item.status === 'pending' ? (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, styles.approve]} onPress={() => handleDecision(item.id, 'approved')}>
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.reject]} onPress={() => handleDecision(item.id, 'rejected')}>
                  <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>    </ScreenLayout>  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, paddingBottom: 32 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginBottom: 18 },
  info: { color: '#cbd5e1' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 16, marginRight: 12 },
  statLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  statValue: { color: '#ffffff', fontSize: 24, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },
  filterButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#111827', marginRight: 10, marginBottom: 10 },
  filterButtonActive: { backgroundColor: '#14b8a6' },
  filterButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  emptyState: { padding: 24, backgroundColor: '#111827', borderRadius: 16, alignItems: 'center' },
  card: { backgroundColor: '#111827', borderRadius: 18, padding: 18, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  room: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#94a3b8', marginTop: 4 },
  purpose: { color: '#cbd5e1', marginBottom: 10 },
  details: { color: '#cbd5e1', marginBottom: 6 },
  actions: { flexDirection: 'row', marginTop: 12 },
  actionBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14 },
  approve: { backgroundColor: '#10b981', marginRight: 12 },
  reject: { backgroundColor: '#ef4444' },
  actionText: { color: '#ffffff', fontWeight: '700' },
  statusTag: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, color: '#ffffff', fontWeight: '700', fontSize: 11 },
  approvedTag: { backgroundColor: '#16a34a' },
  rejectedTag: { backgroundColor: '#ef4444' },
  pendingTag: { backgroundColor: '#f59e0b' },
});
