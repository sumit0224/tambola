import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import type { AppScreenProps } from "../navigation/RootNavigator";
import { joinRoomApi } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/useGameStore";

export function JoinRoomScreen({ navigation }: AppScreenProps<"JoinRoom">) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setRoomContext = useGameStore((state) => state.setRoomContext);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoinRoom() {
    if (!token || !user) {
      Toast.show({ type: "error", text1: "Session missing" });
      return;
    }

    try {
      setLoading(true);

      const room = await joinRoomApi(token, roomCode.trim().toUpperCase(), user);
      setRoomContext({ roomId: room.roomId, roomCode: roomCode.trim().toUpperCase() });

      navigation.replace("RoomLobby", {
        roomId: room.roomId,
        roomCode: roomCode.trim().toUpperCase(),
        isHost: false
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Join failed",
        text2: error instanceof Error ? error.message : "Unable to join room"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Enter Room Code</Text>
        <TextInput
          value={roomCode}
          onChangeText={(text) => setRoomCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          style={styles.input}
          placeholder="AB3X7Q"
          placeholderTextColor="#9ca3af"
        />

        <Pressable
          onPress={handleJoinRoom}
          disabled={loading || roomCode.trim().length < 6}
          style={[styles.primaryBtn, (loading || roomCode.trim().length < 6) && styles.btnDisabled]}
        >
          <Text style={styles.primaryBtnText}>{loading ? "Joining..." : "Join Room"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 24
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 16
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827"
  },
  input: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#111827"
  },
  primaryBtn: {
    marginTop: 18,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 12
  },
  btnDisabled: {
    opacity: 0.5
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff"
  }
});
