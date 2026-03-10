import { StyleSheet, Text, View } from "react-native";
import type { Winner } from "../store/useGameStore";

type Props = {
  winners: Winner[];
};

export function WinnerBanner({ winners }: Props) {
  if (!winners.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Winners</Text>
      {winners.map((entry, index) => (
        <View key={entry.claimType} style={[styles.row, index === winners.length - 1 && styles.rowLast]}>
          <Text style={styles.claim}>{entry.claimType.replace("_", " ")}</Text>
          <Text style={styles.name}>{entry.winner.displayName}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    padding: 12
  },
  title: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#065f46"
  },
  row: {
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  rowLast: {
    marginBottom: 0
  },
  claim: {
    fontWeight: "600",
    color: "#374151"
  },
  name: {
    fontWeight: "700",
    color: "#111827"
  }
});
