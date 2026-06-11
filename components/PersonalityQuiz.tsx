"use client";

import { ArrowLeft, Check, ChevronRight, Edit3, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AnswerId } from "@/data/questions";
import { questions } from "@/data/questions";
import {
  calculateScores,
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
  participantName: string;
};

type CSSVariableStyle = CSSProperties & Record<`--${string}`, string>;

const resultDetails: Record<
  ColorKey,
  {
    accent: string;
  }
> = {
  red: {
    accent: "#e84b42",
  },
  blue: {
    accent: "#2f68c9",
  },
  yellow: {
    accent: "#d9a500",
  },
  green: {
    accent: "#2f8f5b",
  },
};

const resultColorLabels: Record<ColorKey, string> = {
  red: "红色",
  blue: "蓝色",
  yellow: "黄色",
  green: "绿色",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").trim() || "性格色彩测试结果";
}

export function PersonalityQuiz() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [participantName, setParticipantName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isSharingResult, setIsSharingResult] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
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
      setParticipantName(parsed.participantName ?? "");
      setNameDraft(parsed.participantName ?? "");
    } catch {
      setAnswers({});
      setCurrentIndex(0);
      setPhase("intro");
      setParticipantName("");
      setNameDraft("");
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
      participantName,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [answers, currentIndex, hasLoadedStorage, participantName, phase]);

  function beginQuiz() {
    if (!participantName.trim()) {
      setNameDraft("");
      setIsNameDialogOpen(true);
      return;
    }

    setPhase("quiz");
    setReviewOpen(false);
  }

  function submitName() {
    const name = nameDraft.trim();
    if (!name) {
      return;
    }

    setParticipantName(name);
    setIsNameDialogOpen(false);
    setPhase("quiz");
    setReviewOpen(false);
  }

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
    setParticipantName("");
    setNameDraft("");
    setIsNameDialogOpen(false);
    setReviewOpen(false);
    window.localStorage.removeItem(storageKey);
  }

  async function shareResultPdf() {
    setIsSharingResult(true);
    setShareStatus("");
    let report: HTMLDivElement | null = null;

    try {
      const rankedScores = rankScores(scores);
      const topScore = rankedScores[0][1] || 1;
      const resultTitle = summary.dominantColors.map((color) => resultColorLabels[color]).join(" / ");
      const secondaryTitle =
        summary.secondaryColors.length > 0
          ? summary.secondaryColors.map((color) => resultColorLabels[color]).join(" / ")
          : "无";

      report = document.createElement("div");
      report.className = "pdf-report";
      report.style.setProperty("--report-accent", resultDetails[summary.dominant].accent);
      report.innerHTML = `
        <section class="pdf-page">
          <div class="pdf-card pdf-hero">
            <p class="pdf-kicker">性格色彩测试结果</p>
            <h1>${escapeHtml(participantName || "未命名")} 的性格色彩卡片</h1>
            <div class="pdf-hero-grid">
              <div>
                <span>主导颜色</span>
                <strong>${escapeHtml(resultTitle)}</strong>
              </div>
              <div>
                <span>次要颜色</span>
                <strong>${escapeHtml(secondaryTitle)}</strong>
              </div>
              <div>
                <span>完成题数</span>
                <strong>${questions.length} / ${questions.length}</strong>
              </div>
            </div>
          </div>

          <div class="pdf-card">
            <h2>分数明细</h2>
            ${rankedScores
              .map(
                ([color, score], index) => `
                  <div class="pdf-score-row">
                    <div><b>${index + 1}</b><span>${escapeHtml(resultColorLabels[color])}</span></div>
                    <div class="pdf-score-track"><i style="width: ${Math.max((score / topScore) * 100, 4)}%; background: ${
                      resultDetails[color].accent
                    }"></i></div>
                    <strong>${score} 分</strong>
                  </div>
                `,
              )
              .join("")}
          </div>

          <div class="pdf-card">
            <h2>答题记录</h2>
            <div class="pdf-answers">
              ${questions
                .map((question) => {
                  const selectedId = answers[question.id];
                  const selectedAnswer = question.answers.find((answer) => answer.id === selectedId);
                  return `
                    <div class="pdf-answer-item">
                      <p><strong>${question.id}. ${escapeHtml(question.prompt)}</strong></p>
                      <span>${selectedAnswer ? `${selectedAnswer.id}. ${escapeHtml(selectedAnswer.text)}` : "尚未作答"}</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        </section>
      `;

      document.body.appendChild(report);
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(report, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      report.remove();
      report = null;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/png");
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let remainingHeight = imgHeight;
      let imageTop = 0;

      pdf.addImage(imgData, "PNG", 0, imageTop, pageWidth, imgHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        imageTop -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, imageTop, pageWidth, imgHeight);
        remainingHeight -= pageHeight;
      }

      const fileName = `${sanitizeFileName(participantName || "性格色彩测试结果")}-性格色彩测试结果.pdf`;
      const blob = pdf.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "性格色彩测试结果",
          files: [file],
        });
        setShareStatus("已生成 PDF");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        setShareStatus("PDF 已下载");
      }
    } catch (error) {
      console.error(error);
      setShareStatus("PDF 生成失败");
    } finally {
      report?.remove();
      setIsSharingResult(false);
      window.setTimeout(() => setShareStatus(""), 2200);
    }
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
                beginQuiz();
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

          {isNameDialogOpen ? (
            <NameDialog
              nameDraft={nameDraft}
              onChange={setNameDraft}
              onClose={() => setIsNameDialogOpen(false)}
              onSubmit={submitName}
            />
          ) : null}
        </section>
      </main>
    );
  }

  if (phase === "result") {
    const dominantColor = summary.dominant;
    const dominantDetail = resultDetails[dominantColor];
    const rankedScores = rankScores(scores);
    const topScore = rankedScores[0][1] || 1;
    const resultTitle = summary.dominantColors.map((color) => resultColorLabels[color]).join(" / ");
    const secondaryTitle =
      summary.secondaryColors.length > 0
        ? summary.secondaryColors.map((color) => resultColorLabels[color]).join(" / ")
        : "无";

    return (
      <main className="app-shell result-shell">
        <section className="result-layout personality-result">
          <div className="result-summary reveal-one">
            <p className="quiz-title-small">结果</p>
            <h1>{participantName ? `${participantName} 的性格色彩卡片` : "性格色彩卡片"}</h1>
            <p>已完成 30 题。</p>
          </div>

          <div
            className="personality-card reveal-two"
            style={{ "--result-accent": dominantDetail.accent } as CSSVariableStyle}
          >
            <div className="card-topline">
              <span>结果</span>
              <span>30 / 30</span>
            </div>
            <div className="card-identity">
              <span className="card-color-dot" aria-hidden="true" />
              <div>
                <p>主导颜色</p>
                <h2>{resultTitle}</h2>
              </div>
            </div>
            <div className="result-fields">
              <p>
                <span>主导颜色</span>
                <strong>{resultTitle}</strong>
              </p>
              <p>
                <span>次要颜色</span>
                <strong>{secondaryTitle}</strong>
              </p>
              <p>
                <span>主导分数</span>
                <strong>{rankedScores[0][1]} / {questions.length}</strong>
              </p>
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
                  <span>{resultColorLabels[color]}</span>
                </div>
                <div className="score-meter" aria-hidden="true">
                  <span style={{ width: `${Math.max((score / topScore) * 100, 4)}%` }} />
                </div>
                <strong>{score} 分</strong>
              </div>
            ))}
          </div>

          <div className="result-actions reveal-three">
            <button className="primary-button" type="button" onClick={shareResultPdf} disabled={isSharingResult}>
              <Share2 size={17} aria-hidden="true" />
              {isSharingResult ? "正在生成 PDF" : shareStatus || "分享结果"}
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

function NameDialog({
  nameDraft,
  onChange,
  onClose,
  onSubmit,
}: {
  nameDraft: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="name-dialog-backdrop" role="presentation">
      <form
        className="name-dialog"
        aria-label="填写姓名"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <p className="quiz-title-small">开始前</p>
          <h2>请输入姓名</h2>
          <p>结果 PDF 会使用这个名字生成标题。</p>
        </div>
        <label>
          <span>姓名</span>
          <input
            autoFocus
            maxLength={40}
            onChange={(event) => onChange(event.target.value)}
            placeholder="例如：Ben"
            required
            value={nameDraft}
          />
        </label>
        <div className="name-dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            返回
          </button>
          <button className="primary-button" type="submit" disabled={!nameDraft.trim()}>
            开始测试
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
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
