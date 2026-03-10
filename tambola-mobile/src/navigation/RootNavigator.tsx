import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { CreateRoomScreen } from "../screens/CreateRoomScreen";
import { JoinRoomScreen } from "../screens/JoinRoomScreen";
import { RoomLobbyScreen } from "../screens/RoomLobbyScreen";
import { GameScreen } from "../screens/GameScreen";
import { useAuthStore } from "../store/useAuthStore";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  RoomLobby: { roomId: string; roomCode?: string; hostId?: string; isHost?: boolean };
  Game: { roomId: string; roomCode?: string };
};

export type AppScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const token = useAuthStore((state) => state.token);
  const hydrating = useAuthStore((state) => state.hydrating);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (hydrating) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!token ? (
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F8FAFC" }
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerBackTitleVisible: false,
            headerTintColor: "#111827",
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: "#F8FAFC" }
          }}
        >
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Tambola" }} />
          <Stack.Screen name="CreateRoom" component={CreateRoomScreen} options={{ title: "Create Room" }} />
          <Stack.Screen name="JoinRoom" component={JoinRoomScreen} options={{ title: "Join Room" }} />
          <Stack.Screen name="RoomLobby" component={RoomLobbyScreen} options={{ title: "Room Lobby" }} />
          <Stack.Screen name="Game" component={GameScreen} options={{ title: "Game" }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc"
  },
  loadingText: {
    marginTop: 12,
    color: "#4b5563"
  }
});
