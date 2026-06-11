import type { AnswerId } from "@/data/questions";

export type ColorKey = "red" | "blue" | "yellow" | "green";

export type Scores = Record<ColorKey, number>;

export const colorLabels: Record<ColorKey, string> = {
  red: "红色",
  blue: "蓝色",
  yellow: "黄色",
  green: "绿色",
};

export type AnswerMap = Record<number, AnswerId>;

const firstHalfMap: Record<AnswerId, ColorKey> = {
  A: "red",
  B: "blue",
  C: "yellow",
  D: "green",
};

const secondHalfMap: Record<AnswerId, ColorKey> = {
  A: "green",
  B: "yellow",
  C: "blue",
  D: "red",
};

export function scoreAnswer(questionId: number, answerId: AnswerId): ColorKey {
  return questionId <= 15 ? firstHalfMap[answerId] : secondHalfMap[answerId];
}

export function calculateScores(answers: AnswerMap): Scores {
  const scores: Scores = {
    red: 0,
    blue: 0,
    yellow: 0,
    green: 0,
  };

  Object.entries(answers).forEach(([questionId, answerId]) => {
    const color = scoreAnswer(Number(questionId), answerId);
    scores[color] += 1;
  });

  return scores;
}

export function rankScores(scores: Scores) {
  return (Object.entries(scores) as Array<[ColorKey, number]>).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return colorLabels[a[0]].localeCompare(colorLabels[b[0]], "zh-CN");
  });
}

export function summarizeScores(scores: Scores) {
  const ranked = rankScores(scores);
  const topScore = ranked[0][1];
  const closeThreshold = 1;
  const tiedColors = ranked
    .filter(([, score]) => topScore - score <= closeThreshold)
    .map(([color]) => color);

  return {
    ranked,
    dominant: ranked[0][0],
    secondary: tiedColors.length > 1 ? null : ranked[1][0],
    tiedColors: tiedColors.length > 1 ? tiedColors : [],
    isTie: tiedColors.length > 1,
  };
}
