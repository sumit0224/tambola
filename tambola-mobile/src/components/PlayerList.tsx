import { FlatList, StyleSheet, Text, View } from "react-native";
import type { RoomPlayer } from "../store/useGameStore";

type Props = {
  players: RoomPlayer[];
  hostId?: string;
};

export function PlayerList({ players, hostId }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Players ({players.length})</Text>
      <FlatList
        data={players}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.displayName}</Text>
            {hostId === item.userId ? <Text style={styles.hostTag}>HOST</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    padding: 12
  },
  title: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827"
  },
  row: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  name: {
    fontWeight: "600",
    color: "#1f2937"
  },
  hostTag: {
    borderRadius: 999,
    backgroundColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e"
  }
});
