export function shuffleNumbers(): number[] {
  const numbers = Array.from({ length: 90 }, (_, idx) => idx + 1);

  for (let i = numbers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  return numbers;
}
