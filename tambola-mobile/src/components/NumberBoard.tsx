import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type Props = {
  calledNumbers: number[];
  lastCalledNumber: number | null;
};

export function NumberBoard({ calledNumbers, lastCalledNumber }: Props) {
  const calledSet = new Set(calledNumbers);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!lastCalledNumber) {
      return;
    }

    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1.08,
        duration: 140,
        useNativeDriver: true
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true
      })
    ]).start();
  }, [lastCalledNumber, pulse]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Number Board</Text>
        <Text style={styles.badge}>Calls: {calledNumbers.length}</Text>
      </View>

      <Animated.View style={[styles.lastCalledWrap, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.lastCalledText}>{lastCalledNumber ?? "--"}</Text>
      </Animated.View>

      <View style={styles.grid}>
        {Array.from({ length: 90 }, (_, idx) => idx + 1).map((number) => {
          const called = calledSet.has(number);
          return (
            <View key={number} style={[styles.numberCell, called && styles.numberCellActive]}>
              <Text style={[styles.numberText, called && styles.numberTextActive]}>{number}</Text>
            </View>
          );
        })}
      </View>
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
  header: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827"
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#d1fae5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#047857"
  },
  lastCalledWrap: {
    marginBottom: 12,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#fde68a"
  },
  lastCalledText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -2
  },
  numberCell: {
    width: "10%",
    paddingVertical: 5,
    paddingHorizontal: 2
  },
  numberCellActive: {
    backgroundColor: "#10b981",
    borderRadius: 6
  },
  numberText: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    color: "#374151"
  },
  numberTextActive: {
    color: "#ffffff"
  }
});
