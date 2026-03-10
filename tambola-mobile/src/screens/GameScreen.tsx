import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import type { AppScreenProps } from "../navigation/RootNavigator";
import {
  getRoomStateApi,
  getTicketApi,
  submitClaimApi,
  type ClaimType,
  type WinnerEntry
} from "../services/api";
import { connectSocket, emitSocket, onSocketEvent } from "../services/socket";
import { useAuthStore } from "../store/useAuthStore";
import { NumberBoard } from "../components/NumberBoard";
import { TicketGrid } from "../components/TicketGrid";
import { WinnerBanner } from "../components/WinnerBanner";
import { useGameStore } from "../store/useGameStore";

const claimTypes: ClaimType[] = ["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "FULL_HOUSE"];

const fallbackTicket: (number | null)[][] = [
  Array(9).fill(null),
  Array(9).fill(null),
  Array(9).fill(null)
];

export function GameScreen({ route, navigation }: AppScreenProps<"Game">) {
  const { roomId, roomCode } = route.params;
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const {
    ticket,
    calledNumbers,
    winners,
    gameStatus,
    lastCalledNumber,
    setRoomContext,
    setTicket,
    addCalledNumber,
    addWinner,
    setGameStatus,
    hydrateReconnect,
    setCalledNumbers,
    setWinners
  } = useGameStore();

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
      })
      .catch((error) => {
        Toast.show({
          type: "error",
          text1: "Unable to sync state",
          text2: error instanceof Error ? error.message : "Try again"
        });
      });

    void getTicketApi(token, roomId, user)
      .then((result) => setTicket(result.grid))
      .catch(() => {
        // Ticket may not be assigned yet if host hasn't started.
      });

    connectSocket(token, user.displayName);

    const unsubTicket = onSocketEvent("ticket-assigned", (payload) => {
      if (payload.grid) {
        setTicket(payload.grid);
      }
    });

    const unsubCall = onSocketEvent("number-called", (payload) => {
      addCalledNumber(payload.number);
    });

    const unsubWinner = onSocketEvent("winner-announced", (payload) => {
      addWinner(payload as WinnerEntry);
      Toast.show({
        type: "success",
        text1: "Winner announced",
        text2: `${payload.winner.displayName} won ${payload.claimType}`
      });
    });

    const unsubEnded = onSocketEvent("game-ended", (payload) => {
      setGameStatus("ENDED");
      Toast.show({ type: "info", text1: "Game ended", text2: payload.reason });
    });

    const unsubReconnect = onSocketEvent("reconnect-state", (payload) => {
      hydrateReconnect(payload);
      Toast.show({ type: "success", text1: "Reconnected", text2: "State restored" });
    });

    const unsubError = onSocketEvent("error", (payload) => {
      if (payload?.code) {
        Toast.show({ type: "error", text1: "Game error", text2: payload.code });
      }
    });

    emitSocket("join-room", { roomId, roomCode });

    return () => {
      emitSocket("leave-room", { roomId });
      unsubTicket();
      unsubCall();
      unsubWinner();
      unsubEnded();
      unsubReconnect();
      unsubError();
    };
  }, [
    token,
    user,
    roomId,
    roomCode,
    setRoomContext,
    setTicket,
    addCalledNumber,
    addWinner,
    setGameStatus,
    hydrateReconnect,
    setCalledNumbers,
    setWinners
  ]);

  async function handleClaim(claimType: ClaimType) {
    if (!token || !user) {
      return;
    }

    try {
      const result = await submitClaimApi(token, roomId, claimType, user);
      Toast.show({
        type: "success",
        text1: "Claim validated",
        text2: `${result.winner.displayName} won ${result.prize}`
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Claim rejected",
        text2: error instanceof Error ? error.message : "Invalid claim"
      });
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Tambola Game</Text>
        <Text style={styles.meta}>Room: {roomCode ?? roomId.slice(0, 8)}</Text>
        <Text style={styles.meta}>Status: {gameStatus}</Text>
      </View>

      <WinnerBanner winners={winners} />

      <NumberBoard calledNumbers={calledNumbers} lastCalledNumber={lastCalledNumber} />

      <View>
        <Text style={styles.sectionTitle}>My Ticket</Text>
        <TicketGrid grid={ticket ?? fallbackTicket} calledNumbers={calledNumbers} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Claims</Text>
        <View style={styles.claimRow}>
          {claimTypes.map((claimType) => (
            <Pressable
              key={claimType}
              onPress={() => handleClaim(claimType)}
              disabled={gameStatus !== "ACTIVE"}
              style={[styles.claimChip, gameStatus !== "ACTIVE" && styles.btnDisabled]}
            >
              <Text style={styles.claimChipText}>{claimType.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={() => navigation.navigate("RoomLobby", { roomId, roomCode })} style={styles.backLinkWrap}>
        <Text style={styles.backLink}>Back to Lobby</Text>
      </Pressable>
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
  sectionTitle: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827"
  },
  claimRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  claimChip: {
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  claimChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff"
  },
  btnDisabled: {
    opacity: 0.4
  },
  backLinkWrap: {
    marginBottom: 20,
    alignItems: "center"
  },
  backLink: {
    fontWeight: "600",
    color: "#047857"
  }
});
