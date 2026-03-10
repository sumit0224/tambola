import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import type { AppScreenProps } from "../navigation/RootNavigator";
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/useGameStore";

export function DashboardScreen({ navigation }: AppScreenProps<"Dashboard">) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const recentRooms = useGameStore((state) => state.recentRooms);

  async function handleLogout() {
    await logout();
    Toast.show({ type: "success", text1: "Logged out" });
  }

  return (
    <View style={styles.page}>
      <View style={styles.profileCard}>
        <Text style={styles.heading}>Hello, {user?.displayName}</Text>
        <Text style={styles.subHeading}>Create or join a room to start playing.</Text>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={() => navigation.navigate("CreateRoom")} style={[styles.actionBtn, styles.createBtn]}>
          <Text style={styles.actionBtnText}>Create Room</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("JoinRoom")} style={[styles.actionBtn, styles.joinBtn]}>
          <Text style={styles.actionBtnText}>Join Room</Text>
        </Pressable>
      </View>

      <View style={styles.recentCard}>
        <Text style={styles.recentTitle}>Recent Rooms</Text>
        {recentRooms.length === 0 ? (
          <Text style={styles.recentEmpty}>No recent rooms yet.</Text>
        ) : (
          <FlatList
            data={recentRooms}
            keyExtractor={(item) => item.roomId}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  navigation.navigate("RoomLobby", {
                    roomId: item.roomId,
                    roomCode: item.roomCode,
                    isHost: false
                  })
                }
                style={styles.roomItem}
              >
                <Text style={styles.roomName}>Room {item.roomId.slice(0, 8)}</Text>
                <Text style={styles.roomMeta}>Code: {item.roomCode ?? "-"}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 16
  },
  profileCard: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 16
  },
  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827"
  },
  subHeading: {
    marginTop: 4,
    color: "#6b7280"
  },
  logoutBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  logoutText: {
    fontWeight: "600",
    color: "#374151"
  },
  actionRow: {
    marginBottom: 16,
    flexDirection: "row",
    columnGap: 12
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 14
  },
  createBtn: {
    backgroundColor: "#059669"
  },
  joinBtn: {
    backgroundColor: "#111827"
  },
  actionBtnText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff"
  },
  recentCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 16
  },
  recentTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827"
  },
  recentEmpty: {
    color: "#6b7280"
  },
  roomItem: {
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  roomName: {
    fontWeight: "600",
    color: "#1f2937"
  },
  roomMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280"
  }
});
