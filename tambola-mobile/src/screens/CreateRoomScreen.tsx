import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import type { AppScreenProps } from "../navigation/RootNavigator";
import { createRoomApi, type ClaimType } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/useGameStore";

const claimTypes: ClaimType[] = ["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "EARLY_FIVE", "FULL_HOUSE"];

export function CreateRoomScreen({ navigation }: AppScreenProps<"CreateRoom">) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setRoomContext = useGameStore((state) => state.setRoomContext);
  const [maxPlayers, setMaxPlayers] = useState("50");
  const [callInterval, setCallInterval] = useState("5");
  const [selectedClaims, setSelectedClaims] = useState<ClaimType[]>(claimTypes);
  const [loading, setLoading] = useState(false);

  function toggleClaim(claim: ClaimType) {
    setSelectedClaims((prev) => (prev.includes(claim) ? prev.filter((item) => item !== claim) : [...prev, claim]));
  }

  async function handleCreateRoom() {
    if (!token || !user) {
      Toast.show({ type: "error", text1: "Session missing" });
      return;
    }

    if (selectedClaims.length === 0) {
      Toast.show({ type: "error", text1: "Select at least one prize mode" });
      return;
    }

    try {
      setLoading(true);

      const room = await createRoomApi(
        token,
        {
          maxPlayers: Number(maxPlayers),
          callInterval: Number(callInterval),
          prizes: selectedClaims
        },
        user
      );

      setRoomContext({ roomId: room.roomId, roomCode: room.roomCode });

      navigation.replace("RoomLobby", {
        roomId: room.roomId,
        roomCode: room.roomCode,
        hostId: user.id,
        isHost: true
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Unable to create room",
        text2: error instanceof Error ? error.message : "Try again"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Room Settings</Text>

        <Text style={styles.label}>Max Players</Text>
        <TextInput
          value={maxPlayers}
          onChangeText={setMaxPlayers}
          keyboardType="number-pad"
          style={styles.input}
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Call Interval (seconds)</Text>
        <TextInput
          value={callInterval}
          onChangeText={setCallInterval}
          keyboardType="number-pad"
          style={styles.input}
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Prize Modes</Text>
        <View style={styles.claimRow}>
          {claimTypes.map((claim) => {
            const selected = selectedClaims.includes(claim);
            return (
              <Pressable key={claim} onPress={() => toggleClaim(claim)} style={[styles.claimChip, selected && styles.claimChipActive]}>
                <Text style={[styles.claimChipText, selected && styles.claimChipTextActive]}>{claim.replace("_", " ")}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={handleCreateRoom} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
          <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Create Room"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16
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
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563"
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#111827"
  },
  claimRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  claimChip: {
    borderRadius: 999,
    backgroundColor: "#e4e4e7",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  claimChipActive: {
    backgroundColor: "#059669"
  },
  claimChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151"
  },
  claimChipTextActive: {
    color: "#ffffff"
  },
  primaryBtn: {
    marginTop: 24,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#059669",
    paddingVertical: 12
  },
  btnDisabled: {
    opacity: 0.6
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff"
  }
});
