import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

const tabs = [
  { key: "Dashboard", label: "Dashboard" },
  { key: "RoomStatus", label: "Live Status" },
  { key: "Viewer3D", label: "3D Map" },
  { key: "Reservation", label: "Book a Room" },
  { key: "Profile", label: "Profile" },
];

export default function BottomTabBar({ navigation, active }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.panel, borderTopColor: theme.border }]}>      
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              {
                backgroundColor: isActive ? theme.accent : theme.card,
                borderColor: isActive ? theme.background : theme.border,
              },
            ]}
            onPress={() => navigation.navigate(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, { color: isActive ? theme.tabActiveText : theme.tabText }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tab: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
});
