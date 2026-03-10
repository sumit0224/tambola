import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Props = {
  value: number | null;
  marked: boolean;
};

export function TicketCell({ value, marked }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!marked) {
      return;
    }

    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.1,
        useNativeDriver: true,
        friction: 5
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5
      })
    ]).start();
  }, [marked, scale]);

  const cellStyle = [
    styles.cell,
    value === null ? styles.emptyCell : marked ? styles.markedCell : styles.normalCell
  ];

  return (
    <Animated.View style={[{ transform: [{ scale }] }, cellStyle]}>
      <Text style={[styles.value, value === null && styles.hiddenValue]}>{value ?? "--"}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1
  },
  normalCell: {
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff"
  },
  markedCell: {
    borderColor: "#34d399",
    backgroundColor: "#bbf7d0"
  },
  emptyCell: {
    borderColor: "#e4e4e7",
    backgroundColor: "#f4f4f5"
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827"
  },
  hiddenValue: {
    color: "transparent"
  }
});
