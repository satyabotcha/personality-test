"use client";

import { ArrowLeft, Check, ChevronRight, Clipboard, Edit3, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AnswerId } from "@/data/questions";
import { questions } from "@/data/questions";
import {
  calculateScores,
  colorLabels,
  rankScores,
  summarizeScores,
  type AnswerMap,
  type ColorKey,
} from "@/lib/scoring";

const storageKey = "personality-color-quiz:v1";

type QuizPhase = "intro" | "quiz" | "result";

type StoredState = {
  answers: AnswerMap;
  currentIndex: number;
  phase: QuizPhase;
};

type CSSVariableStyle = CSSProperties & Record<`--${string}`, string>;

const resultDetails: Record<
  ColorKey,
  {
    traits: string;
    description: string;
    accent: string;
  }
> = {
  red: {
    traits: "热情 / 表达 / 行动力",
    description: "你更容易被新鲜感、连接感和即时反馈点燃，擅长把气氛带起来。",
    accent: "#e84b42",
  },
  blue: {
    traits: "细腻 / 秩序 / 深度",
    description: "你倾向于先理解本质，再做出选择，重视准确、承诺和长期稳定。",
    accent: "#2f68c9",
  },
  yellow: {
    traits: "目标 / 推进 / 掌控",
    description: "你看重结果和效率，遇到挑战时通常会自然地走到前面。",
    accent: "#d9a500",
  },
  green: {
    traits: "平和 / 稳定 / 协调",
    description: "你更在乎舒适、关系和节奏感，擅长让事情自然地落到合适的位置。",
    accent: "#2f8f5b",
  },
};

export function PersonalityQuiz() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const remainingCount = questions.length - answeredCount;
  const progressPercent =
    phase === "result"
      ? 100
      : Math.round(((currentIndex + (answers[currentQuestion?.id] ? 1 : 0)) / questions.length) * 100);

  const scores = useMemo(() => calculateScores(answers), [answers]);
  const summary = useMemo(() => summarizeScores(scores), [scores]);
  const allAnswered = answeredCount === questions.length;
  const questionTextLength =
    currentQuestion.prompt.length + currentQuestion.answers.reduce((total, answer) => total + answer.text.length, 0);
  const isCompactQuestion = questionTextLength > 190;
  const headerStatusText = currentIndex === questions.length - 1 ? "最后 1 题" : `已答 ${answeredCount}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setHasLoadedStorage(true);
        return;
      }

      const parsed = JSON.parse(stored) as StoredState;
      setAnswers(parsed.answers ?? {});
      setCurrentIndex(Math.min(parsed.currentIndex ?? 0, questions.length - 1));
      setPhase(parsed.phase ?? "intro");
    } catch {
      setAnswers({});
      setCurrentIndex(0);
      setPhase("intro");
    } finally {
      setHasLoadedStorage(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    const state: StoredState = {
      answers,
      currentIndex,
      phase,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [answers, currentIndex, hasLoadedStorage, phase]);

  function selectAnswer(answerId: AnswerId) {
    if (isAdvancing) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: answerId,
    }));

    setIsAdvancing(true);

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    advanceTimerRef.current = setTimeout(() => {
      setIsAdvancing(false);
      setReviewOpen(false);

      if (allAnswered || currentIndex === questions.length - 1) {
        setPhase("result");
        return;
      }

      setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
    }, 430);
  }

  function goNext() {
    if (!answers[currentQuestion.id]) {
      return;
    }

    if (allAnswered) {
      setPhase("result");
      setReviewOpen(false);
      return;
    }

    if (currentIndex === questions.length - 1) {
      setPhase("result");
      setReviewOpen(false);
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  function goBack() {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      setIsAdvancing(false);
    }

    if (currentIndex === 0) {
      setPhase("intro");
      return;
    }

    setCurrentIndex((index) => index - 1);
  }

  function editQuestion(index: number) {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    setIsAdvancing(false);
    setCurrentIndex(index);
    setPhase("quiz");
    setReviewOpen(false);
  }

  function resetQuiz() {
    setAnswers({});
    setCurrentIndex(0);
    setPhase("intro");
    setReviewOpen(false);
    window.localStorage.removeItem(storageKey);
  }

  async function copyResult() {
    const ranked = rankScores(scores)
      .map(([color, score], index) => `${index + 1}. ${colorLabels[color]}：${score} 分`)
      .join("\n");
    const resultTitle = summary.isDominantTie
      ? `主导颜色并列：${summary.dominantColors.map((color) => colorLabels[color]).join(" / ")}`
      : `主导颜色：${colorLabels[summary.dominant]}`;
    const secondary =
      summary.secondaryColors.length > 0
        ? `\n次要颜色${summary.isSecondaryTie ? "并列" : ""}：${summary.secondaryColors
            .map((color) => colorLabels[color])
            .join(" / ")}`
        : "";

    await navigator.clipboard.writeText(`${resultTitle}${secondary}\n\n${ranked}`);
    setCopiedResult(true);
    window.setTimeout(() => setCopiedResult(false), 1800);
  }

  if (!hasLoadedStorage) {
    return (
      <main className="app-shell">
        <section className="loading-state" aria-live="polite">
          正在载入测试...
        </section>
      </main>
    );
  }

  if (phase === "intro") {
    return (
      <main className="app-shell">
        <section className="intro-panel">
          <div className="intro-copy">
            <p className="quiz-title-small">基础版性格色彩测试题</p>
            <h1>基础版性格色彩测试题</h1>
            <div className="intro-meta" aria-label="测试信息">
              <span>30 题</span>
              <span>约 3-5 分钟</span>
              <span>逐题作答</span>
            </div>
            <p>
              FPA性格色彩用“红、蓝、黄、绿”四色代替人的性格类型，通过对“性格色彩密码”的解读，帮助你学会以“有‘色’眼睛”洞察人性，增强对人生的洞察力，并修炼个性，从而掌握自己的命运。本测试题目旨在测试你的“性格”而非你的“个性”，测试你的“先天”而非你的“后天”。如果你在做题过程中，严格符合测试说明，你将了解自己性格本源的力量。
            </p>
          </div>

          <div className="intro-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setPhase("quiz");
                setReviewOpen(false);
              }}
            >
              {answeredCount > 0 ? "继续测试" : "开始测试"}
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            {answeredCount > 0 ? (
              <button className="ghost-button" type="button" onClick={resetQuiz}>
                <RotateCcw size={17} aria-hidden="true" />
                重新开始
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  if (phase === "result") {
    const dominantColor = summary.dominant;
    const dominantDetail = summary.isDominantTie
      ? {
          traits: "复合倾向 / 弹性 / 多面",
          description: "你的最高分颜色彼此接近，说明你可能会根据场景切换不同的行动方式。",
          accent: resultDetails[dominantColor].accent,
        }
      : resultDetails[dominantColor];
    const rankedScores = rankScores(scores);
    const topScore = rankedScores[0][1] || 1;
    const resultTitle = summary.isDominantTie
      ? summary.dominantColors.map((color) => colorLabels[color]).join(" / ")
      : colorLabels[dominantColor];
    const supportingColors = summary.isDominantTie ? summary.dominantColors : summary.secondaryColors;

    return (
      <main className="app-shell result-shell">
        <section className="result-layout personality-result">
          <div className="result-summary reveal-one">
            <p className="quiz-title-small">测试完成</p>
            <h1>你的性格色彩卡片已生成。</h1>
            <p>这不是标签，而是一张用来理解自己行动方式的简洁快照。</p>
          </div>

          <div
            className="personality-card reveal-two"
            style={{ "--result-accent": dominantDetail.accent } as CSSVariableStyle}
          >
            <div className="card-topline">
              <span>PERSONALITY COLOR</span>
              <span>30 / 30</span>
            </div>
            <div className="card-identity">
              <span className="card-color-dot" aria-hidden="true" />
              <div>
                <p>主导颜色</p>
                <h2>{resultTitle}</h2>
              </div>
            </div>
            <p className="card-traits">{dominantDetail.traits}</p>
            <p className="card-description">{dominantDetail.description}</p>
            <div className="card-meta">
              <span>{rankedScores[0][1]} / {questions.length}</span>
              <span>
                {supportingColors.length > 0
                  ? `相邻色：${supportingColors.map((color) => colorLabels[color]).join(" / ")}`
                  : "色彩分布均衡"}
              </span>
            </div>
          </div>

          <div className="score-panel card-score-panel reveal-two" aria-label="分数明细">
            {rankedScores.map(([color, score], index) => (
              <div
                className="score-row card-score-row"
                key={color}
                style={{ "--score-color": resultDetails[color].accent } as CSSVariableStyle}
              >
                <div>
                  <span className="score-rank color-rank">{index + 1}</span>
                  <span>{colorLabels[color]}</span>
                </div>
                <div className="score-meter" aria-hidden="true">
                  <span style={{ width: `${Math.max((score / topScore) * 100, 4)}%` }} />
                </div>
                <strong>{score} 分</strong>
              </div>
            ))}
          </div>

          <div className="result-actions reveal-three">
            <button className="primary-button" type="button" onClick={copyResult}>
              <Clipboard size={17} aria-hidden="true" />
              {copiedResult ? "已复制结果" : "复制结果"}
            </button>
            <button className="primary-button" type="button" onClick={() => setReviewOpen(true)}>
              <Edit3 size={17} aria-hidden="true" />
              查看并修改答案
            </button>
            <button className="ghost-button" type="button" onClick={resetQuiz}>
              <RotateCcw size={17} aria-hidden="true" />
              重新测试
            </button>
          </div>

          {reviewOpen ? (
            <ReviewPanel answers={answers} onClose={() => setReviewOpen(false)} onEdit={editQuestion} />
          ) : null}
        </section>
      </main>
    );
  }

  const selectedAnswer = answers[currentQuestion.id];

  return (
    <main className="app-shell quiz-shell">
      <section className="quiz-card" aria-labelledby="question-title">
        <header className="quiz-header">
          <button className="icon-button" type="button" onClick={goBack} aria-label="返回上一题">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className="progress-copy">
            <span>
              第 {currentIndex + 1} 题 / 共 {questions.length} 题
            </span>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <button className="text-button" type="button" onClick={() => setReviewOpen(true)}>
            {headerStatusText}
          </button>
        </header>

        <div
          className={`question-body${isAdvancing ? " advancing" : ""}${isCompactQuestion ? " compact" : ""}`}
          key={currentQuestion.id}
        >
          <p className="question-kicker">请选择最贴近你的描述</p>
          <h1 id="question-title">{currentQuestion.prompt}</h1>

          <div className="answers-list" role="radiogroup" aria-labelledby="question-title">
            {currentQuestion.answers.map((answer) => {
              const isSelected = selectedAnswer === answer.id;

              return (
                <button
                  className={`answer-option${isSelected ? " selected" : ""}`}
                  key={answer.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isAdvancing}
                  onClick={() => selectAnswer(answer.id)}
                >
                  <span className="answer-letter">{answer.id}</span>
                  <span>{answer.text}</span>
                  {isSelected ? <Check className="answer-check" size={18} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="quiz-footer">
          <div className="quiz-footnote">
            {isAdvancing ? "已选择，正在进入下一题..." : remainingCount > 0 ? `还剩 ${remainingCount} 题` : "全部完成"}
          </div>
          <button className="ghost-button" type="button" onClick={goBack}>
            返回
          </button>
          <button className="primary-button" type="button" onClick={goNext} disabled={!selectedAnswer}>
            {allAnswered || currentIndex === questions.length - 1 ? "查看结果" : "下一题"}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </footer>
      </section>

      {reviewOpen ? (
        <ReviewPanel answers={answers} onClose={() => setReviewOpen(false)} onEdit={editQuestion} />
      ) : null}
    </main>
  );
}

function ReviewPanel({
  answers,
  onClose,
  onEdit,
}: {
  answers: AnswerMap;
  onClose: () => void;
  onEdit: (index: number) => void;
}) {
  return (
    <aside className="review-panel" aria-label="已答题目">
      <div className="review-header">
        <div>
          <p className="quiz-title-small">答题回顾</p>
          <h2>可返回修改任意一题</h2>
        </div>
        <button className="text-button" type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="review-list">
        {questions.map((question, index) => {
          const answerId = answers[question.id];
          const answer = question.answers.find((option) => option.id === answerId);

          return (
            <button
              className={`review-item${answerId ? "" : " unanswered"}`}
              key={question.id}
              type="button"
              onClick={() => onEdit(index)}
            >
              <span className="review-number">{question.id}</span>
              <span className="review-text">
                {answer ? `${answer.id}. ${answer.text}` : "尚未作答"}
              </span>
              <Edit3 size={15} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
