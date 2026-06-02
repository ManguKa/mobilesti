import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ReservationScreen from "../screens/ReservationScreen";
import ReservationHistoryScreen from "../screens/ReservationHistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ApprovalScreen from "../screens/ApprovalScreen";
import RoomStatusScreen from "../screens/RoomStatusScreen";
import Viewer3DScreen from "../screens/Viewer3DScreen";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Reservation" component={ReservationScreen} />
      <Stack.Screen name="History" component={ReservationHistoryScreen} />
      <Stack.Screen name="Approvals" component={ApprovalScreen} />
      <Stack.Screen name="RoomStatus" component={RoomStatusScreen} />
      <Stack.Screen name="Viewer3D" component={Viewer3DScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return user ? <AppStack /> : <AuthStack />;
}
