"use client";

import { ArrowLeft, Check, ChevronRight, Edit3, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AnswerId } from "@/data/questions";
import { questions } from "@/data/questions";
import {
  calculateScores,
  colorLabels,
  rankScores,
  summarizeScores,
  type AnswerMap,
} from "@/lib/scoring";

const storageKey = "personality-color-quiz:v1";

type QuizPhase = "intro" | "quiz" | "result";

type StoredState = {
  answers: AnswerMap;
  currentIndex: number;
  phase: QuizPhase;
};

function getInitialState(): StoredState {
  return {
    answers: {},
    currentIndex: 0,
    phase: "intro",
  };
}

export function PersonalityQuiz() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent =
    phase === "result"
      ? 100
      : Math.round(((currentIndex + (answers[currentQuestion?.id] ? 1 : 0)) / questions.length) * 100);

  const scores = useMemo(() => calculateScores(answers), [answers]);
  const summary = useMemo(() => summarizeScores(scores), [scores]);
  const allAnswered = answeredCount === questions.length;

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
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: answerId,
    }));
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
    if (currentIndex === 0) {
      setPhase("intro");
      return;
    }

    setCurrentIndex((index) => index - 1);
  }

  function editQuestion(index: number) {
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
    return (
      <main className="app-shell">
        <section className="result-layout">
          <div className="result-summary">
            <p className="quiz-title-small">测试结果</p>
            {summary.isTie ? (
              <>
                <h1>结果接近：{summary.tiedColors.map((color) => colorLabels[color]).join(" / ")}</h1>
                <p>最高分之间相差不超过 1 分，建议按并列倾向理解。</p>
              </>
            ) : (
              <>
                <h1>主导颜色：{colorLabels[summary.dominant]}</h1>
                <p>次要颜色：{summary.secondary ? colorLabels[summary.secondary] : "暂无"}</p>
              </>
            )}
          </div>

          <div className="score-panel" aria-label="分数明细">
            {rankScores(scores).map(([color, score], index) => (
              <div className="score-row" key={color}>
                <div>
                  <span className="score-rank">{index + 1}</span>
                  <span>{colorLabels[color]}</span>
                </div>
                <strong>{score} 分</strong>
              </div>
            ))}
          </div>

          <div className="result-actions">
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
    <main className="app-shell">
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
            已答 {answeredCount}
          </button>
        </header>

        <div className="question-body">
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
