import React from "react";
import { SafeAreaView, View, StyleSheet } from "react-native";
import BottomTabBar from "./BottomTabBar";
import { useTheme } from "../context/ThemeContext";

export default function ScreenLayout({ navigation, active, children }) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.safeArea }]}>      
      <View style={[styles.content, { backgroundColor: theme.background }]}>{children}</View>
      <BottomTabBar navigation={navigation} active={active} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
