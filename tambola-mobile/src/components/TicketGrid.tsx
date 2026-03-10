import { StyleSheet, View } from "react-native";
import { TicketCell } from "./TicketCell";

type Props = {
  grid: (number | null)[][];
  calledNumbers: number[];
};

export function TicketGrid({ grid, calledNumbers }: Props) {
  const calledSet = new Set(calledNumbers);

  return (
    <View style={styles.container}>
      {grid.map((row, rowIdx) => (
        <View key={`row-${rowIdx}`} style={[styles.row, rowIdx === grid.length - 1 && styles.rowLast]}>
          {row.map((value, colIdx) => (
            <View key={`cell-${rowIdx}-${colIdx}`} style={styles.cellWrap}>
              <TicketCell value={value} marked={value !== null && calledSet.has(value)} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    padding: 12
  },
  row: {
    flexDirection: "row",
    marginBottom: 8
  },
  rowLast: {
    marginBottom: 0
  },
  cellWrap: {
    flex: 1,
    marginHorizontal: 2
  }
});
