import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import type { AppScreenProps } from "../navigation/RootNavigator";
import { getRoomStateApi, startGameApi, type RoomPlayer } from "../services/api";
import { connectSocket, emitSocket, onSocketEvent } from "../services/socket";
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/useGameStore";
import { PlayerList } from "../components/PlayerList";

export function RoomLobbyScreen({ navigation, route }: AppScreenProps<"RoomLobby">) {
  const { roomId, roomCode, hostId, isHost } = route.params;
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const {
    players,
    roomCode: storeRoomCode,
    gameStatus,
    calledNumbers,
    winners,
    setRoomContext,
    setPlayers,
    addOrUpdatePlayer,
    setGameStatus,
    hydrateReconnect,
    setWinners,
    setCalledNumbers
  } = useGameStore();

  const [starting, setStarting] = useState(false);

  const effectiveRoomCode = useMemo(() => roomCode ?? storeRoomCode ?? "-", [roomCode, storeRoomCode]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    setRoomContext({ roomId, roomCode });

    void getRoomStateApi(token, roomId)
      .then((state) => {
        setGameStatus(state.status);
        setCalledNumbers(state.calledNumbers);
        setWinners(state.winners);

        if (state.status === "ACTIVE") {
          navigation.replace("Game", { roomId, roomCode: effectiveRoomCode });
        }
      })
      .catch((error) => {
        Toast.show({
          type: "error",
          text1: "Room load failed",
          text2: error instanceof Error ? error.message : "Unable to fetch room"
        });
      });

    connectSocket(token, user.displayName);

    const unsubscribeRoomJoined = onSocketEvent("room-joined", (payload) => {
      if (payload.roomId !== roomId) {
        return;
      }

      if (payload.roomCode) {
        setRoomContext({ roomId, roomCode: payload.roomCode });
      }

      if (payload.status) {
        setGameStatus(payload.status);
      }

      if (payload.players) {
        setPlayers(payload.players as RoomPlayer[]);
      }
    });

    const unsubscribePlayerJoined = onSocketEvent("player-joined", (payload) => {
      addOrUpdatePlayer({ userId: payload.userId, displayName: payload.displayName });
    });

    const unsubscribeGameStarted = onSocketEvent("game-started", () => {
      setGameStatus("ACTIVE");
      Toast.show({ type: "success", text1: "Game started" });
      navigation.replace("Game", { roomId, roomCode: effectiveRoomCode });
    });

    const unsubscribeReconnect = onSocketEvent("reconnect-state", (payload) => {
      hydrateReconnect(payload);
      Toast.show({ type: "success", text1: "Reconnected", text2: "Game state restored" });
    });

    const unsubscribeError = onSocketEvent("error", (payload) => {
      if (!payload?.code) {
        return;
      }

      Toast.show({ type: "error", text1: "Socket error", text2: payload.code });
    });

    emitSocket("join-room", { roomId, roomCode });

    return () => {
      emitSocket("leave-room", { roomId });
      unsubscribeRoomJoined();
      unsubscribePlayerJoined();
      unsubscribeGameStarted();
      unsubscribeReconnect();
      unsubscribeError();
    };
  }, [
    token,
    user,
    roomId,
    roomCode,
    setRoomContext,
    setPlayers,
    addOrUpdatePlayer,
    setGameStatus,
    hydrateReconnect,
    navigation,
    effectiveRoomCode,
    setWinners,
    setCalledNumbers
  ]);

  async function handleStartGame() {
    if (!token || !user) {
      return;
    }

    try {
      setStarting(true);
      await startGameApi(token, roomId, user);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Start failed",
        text2: error instanceof Error ? error.message : "Unable to start"
      });
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Room Lobby</Text>
        <Text style={styles.meta}>Room ID: {roomId.slice(0, 8)}</Text>
        <Text style={styles.meta}>Room Code: {effectiveRoomCode}</Text>
        <Text style={styles.meta}>Status: {gameStatus}</Text>

        {isHost ? (
          <Pressable
            onPress={handleStartGame}
            disabled={starting || players.length < 2 || gameStatus !== "LOBBY"}
            style={[
              styles.primaryBtn,
              (starting || players.length < 2 || gameStatus !== "LOBBY") && styles.btnDisabled
            ]}
          >
            <Text style={styles.primaryBtnText}>{starting ? "Starting..." : "Start Game"}</Text>
          </Pressable>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Waiting for host to start the game.</Text>
          </View>
        )}

        {players.length < 2 ? <Text style={styles.warning}>At least 2 players required to start.</Text> : null}
      </View>

      <PlayerList players={players} hostId={hostId} />

      {gameStatus !== "LOBBY" ? (
        <Pressable onPress={() => navigation.replace("Game", { roomId, roomCode: effectiveRoomCode })} style={styles.darkBtn}>
          <Text style={styles.darkBtnText}>Open Game</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.snapshotTitle}>Realtime Snapshot</Text>
        <Text style={styles.meta}>Called: {calledNumbers.length}</Text>
        <Text style={styles.meta}>Winners: {winners.length}</Text>
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
    paddingVertical: 16,
    rowGap: 12
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
  meta: {
    marginTop: 4,
    color: "#4b5563"
  },
  primaryBtn: {
    marginTop: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#059669",
    paddingVertical: 12
  },
  btnDisabled: {
    opacity: 0.5
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff"
  },
  infoBox: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
    padding: 12
  },
  infoText: {
    fontSize: 13,
    color: "#4b5563"
  },
  warning: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: "#b45309"
  },
  darkBtn: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 12
  },
  darkBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff"
  },
  snapshotTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827"
  }
});
