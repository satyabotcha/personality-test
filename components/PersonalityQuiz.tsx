"use client";

import { ArrowLeft, Check, ChevronRight, Edit3, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AnswerId, Question } from "@/data/questions";
import { enQuestions } from "@/data/questions.en";
import { questions as zhQuestions } from "@/data/questions";
import {
  calculateScores,
  rankScores,
  summarizeScores,
  type AnswerMap,
  type ColorKey,
} from "@/lib/scoring";

const storageKey = "personality-color-quiz:v1";

type Language = "en" | "zh";
type QuizPhase = "intro" | "quiz" | "result";

type StoredState = {
  answers: AnswerMap;
  currentIndex: number;
  language?: Language;
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

const resultColorLabels: Record<Language, Record<ColorKey, string>> = {
  en: {
    red: "Red",
    blue: "Blue",
    yellow: "Yellow",
    green: "Green",
  },
  zh: {
    red: "红色",
    blue: "蓝色",
    yellow: "黄色",
    green: "绿色",
  },
};

const uiText = {
  en: {
    loading: "Loading quiz...",
    introLabel: "Base personality color test",
    introTitle: "Base personality color test",
    introMeta: ["30 questions", "About 3-5 min", "One question at a time"],
    introBody:
      "FPA personality color uses red, blue, yellow, and green to represent personality types. This test is designed to help you understand the source of your personality more clearly. Answer from your natural instincts, not from what you have learned to become.",
    start: "Start test",
    continue: "Continue test",
    restart: "Restart",
    result: "Result",
    resultTitle: (name: string) => (name ? `${name}'s personality color card` : "Personality color card"),
    completed: "Completed 30 questions.",
    cardResult: "Result",
    dominant: "Dominant color",
    secondary: "Secondary color",
    none: "None",
    dominantScore: "Dominant score",
    scoreDetails: "Score details",
    points: (score: number) => `${score} pts`,
    share: "Share result",
    sharing: "Creating PDF",
    pdfReady: "PDF generated",
    pdfDownloaded: "PDF downloaded",
    pdfFailed: "PDF generation failed",
    reviewAnswers: "Review and edit answers",
    retake: "Retake test",
    backQuestion: "Back to previous question",
    questionCount: (current: number, total: number) => `Question ${current} / ${total}`,
    finalQuestion: "Final question",
    answered: (count: number) => `${count} answered`,
    choose: "Choose the description that feels closest to you",
    advancing: "Selected. Moving to the next question...",
    remaining: (count: number) => (count > 0 ? `${count} remaining` : "All complete"),
    back: "Back",
    next: "Next",
    viewResult: "View result",
    beforeStart: "Before you begin",
    nameTitle: "Enter your name",
    nameHelp: "The result PDF will use this name as the title.",
    nameLabel: "Name",
    namePlaceholder: "For example: Ben",
    reviewLabel: "Answered questions",
    reviewTitle: "Answer review",
    reviewSubtitle: "Return to edit any question",
    close: "Close",
    unanswered: "Not answered yet",
    unnamed: "Unnamed",
    pdfTitle: "Personality color test result",
    completedQuestions: "Completed questions",
    answerRecord: "Answer record",
  },
  zh: {
    loading: "正在载入测试...",
    introLabel: "基础版性格色彩测试题",
    introTitle: "基础版性格色彩测试题",
    introMeta: ["30 题", "约 3-5 分钟", "逐题作答"],
    introBody:
      "FPA性格色彩用“红、蓝、黄、绿”四色代替人的性格类型，通过对“性格色彩密码”的解读，帮助你学会以“有‘色’眼睛”洞察人性，增强对人生的洞察力，并修炼个性，从而掌握自己的命运。本测试题目旨在测试你的“性格”而非你的“个性”，测试你的“先天”而非你的“后天”。如果你在做题过程中，严格符合测试说明，你将了解自己性格本源的力量。",
    start: "开始测试",
    continue: "继续测试",
    restart: "重新开始",
    result: "结果",
    resultTitle: (name: string) => (name ? `${name} 的性格色彩卡片` : "性格色彩卡片"),
    completed: "已完成 30 题。",
    cardResult: "结果",
    dominant: "主导颜色",
    secondary: "次要颜色",
    none: "无",
    dominantScore: "主导分数",
    scoreDetails: "分数明细",
    points: (score: number) => `${score} 分`,
    share: "分享结果",
    sharing: "正在生成 PDF",
    pdfReady: "已生成 PDF",
    pdfDownloaded: "PDF 已下载",
    pdfFailed: "PDF 生成失败",
    reviewAnswers: "查看并修改答案",
    retake: "重新测试",
    backQuestion: "返回上一题",
    questionCount: (current: number, total: number) => `第 ${current} 题 / 共 ${total} 题`,
    finalQuestion: "最后 1 题",
    answered: (count: number) => `已答 ${count}`,
    choose: "请选择最贴近你的描述",
    advancing: "已选择，正在进入下一题...",
    remaining: (count: number) => (count > 0 ? `还剩 ${count} 题` : "全部完成"),
    back: "返回",
    next: "下一题",
    viewResult: "查看结果",
    beforeStart: "开始前",
    nameTitle: "请输入姓名",
    nameHelp: "结果 PDF 会使用这个名字生成标题。",
    nameLabel: "姓名",
    namePlaceholder: "例如：Ben",
    reviewLabel: "已答题目",
    reviewTitle: "答题回顾",
    reviewSubtitle: "可返回修改任意一题",
    close: "关闭",
    unanswered: "尚未作答",
    unnamed: "未命名",
    pdfTitle: "性格色彩测试结果",
    completedQuestions: "完成题数",
    answerRecord: "答题记录",
  },
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

function downloadPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PersonalityQuiz() {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [language, setLanguage] = useState<Language>("zh");
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

  const text = uiText[language];
  const questions = language === "en" ? enQuestions : zhQuestions;
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
  const isCompactQuestion = currentQuestion.id === 30 || questionTextLength > 430;
  const headerStatusText = currentIndex === questions.length - 1 ? text.finalQuestion : text.answered(answeredCount);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setHasLoadedStorage(true);
        return;
      }

      const parsed = JSON.parse(stored) as StoredState;
      setAnswers(parsed.answers ?? {});
      setCurrentIndex(Math.min(parsed.currentIndex ?? 0, zhQuestions.length - 1));
      setLanguage(parsed.language ?? "zh");
      setPhase(parsed.phase ?? "intro");
      setParticipantName(parsed.participantName ?? "");
      setNameDraft(parsed.participantName ?? "");
    } catch {
      setAnswers({});
      setCurrentIndex(0);
      setLanguage("zh");
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
      language,
      phase,
      participantName,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [answers, currentIndex, hasLoadedStorage, language, participantName, phase]);

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
    }, 330);
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
      const resultTitle = summary.dominantColors.map((color) => resultColorLabels[language][color]).join(" / ");
      const secondaryTitle =
        summary.secondaryColors.length > 0
          ? summary.secondaryColors.map((color) => resultColorLabels[language][color]).join(" / ")
          : text.none;

      report = document.createElement("div");
      report.className = "pdf-report";
      report.style.setProperty("--report-accent", resultDetails[summary.dominant].accent);
      report.innerHTML = `
        <section class="pdf-page">
          <div class="pdf-card pdf-hero">
            <p class="pdf-kicker">${escapeHtml(text.pdfTitle)}</p>
            <h1>${escapeHtml(text.resultTitle(participantName || text.unnamed))}</h1>
            <div class="pdf-hero-grid">
              <div>
                <span>${escapeHtml(text.dominant)}</span>
                <strong>${escapeHtml(resultTitle)}</strong>
              </div>
              <div>
                <span>${escapeHtml(text.secondary)}</span>
                <strong>${escapeHtml(secondaryTitle)}</strong>
              </div>
              <div>
                <span>${escapeHtml(text.completedQuestions)}</span>
                <strong>${questions.length} / ${questions.length}</strong>
              </div>
            </div>
          </div>

          <div class="pdf-card">
            <h2>${escapeHtml(text.scoreDetails)}</h2>
            ${rankedScores
              .map(
                ([color, score], index) => `
                  <div class="pdf-score-row">
                    <div><b>${index + 1}</b><span>${escapeHtml(resultColorLabels[language][color])}</span></div>
                    <div class="pdf-score-track"><i style="width: ${Math.max((score / topScore) * 100, 4)}%; background: ${
                      resultDetails[color].accent
                    }"></i></div>
                    <strong>${escapeHtml(text.points(score))}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>

          <div class="pdf-card">
            <h2>${escapeHtml(text.answerRecord)}</h2>
            <div class="pdf-answers">
              ${questions
                .map((question) => {
                  const selectedId = answers[question.id];
                  const selectedAnswer = question.answers.find((answer) => answer.id === selectedId);
                  return `
                    <div class="pdf-answer-item">
                      <p><strong>${question.id}. ${escapeHtml(question.prompt)}</strong></p>
                      <span>${selectedAnswer ? `${selectedAnswer.id}. ${escapeHtml(selectedAnswer.text)}` : escapeHtml(text.unanswered)}</span>
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

      const fileName = `${sanitizeFileName(participantName || text.pdfTitle)}-${language}-result.pdf`;
      const blob = pdf.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: text.pdfTitle,
            files: [file],
          });
          setShareStatus(text.pdfReady);
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") {
            return;
          }
        }
      }

      downloadPdf(blob, fileName);
      setShareStatus(text.pdfDownloaded);
    } catch (error) {
      console.error(error);
      setShareStatus(text.pdfFailed);
    } finally {
      report?.remove();
      setIsSharingResult(false);
      window.setTimeout(() => setShareStatus(""), 2200);
    }
  }

  if (!hasLoadedStorage) {
    return (
      <main className="app-shell" lang={language}>
        <section className="loading-state" aria-live="polite">
          {text.loading}
        </section>
      </main>
    );
  }

  if (phase === "intro") {
    return (
      <main className="app-shell language-shell" lang={language}>
        <LanguagePill language={language} onChange={setLanguage} />
        <section className="intro-panel">
          <div className="intro-copy">
            <p className="quiz-title-small">{text.introLabel}</p>
            <h1>{text.introTitle}</h1>
            <div className="intro-meta" aria-label={text.introLabel}>
              {text.introMeta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <p>{text.introBody}</p>
          </div>

          <div className="intro-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                beginQuiz();
              }}
            >
              {answeredCount > 0 ? text.continue : text.start}
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            {answeredCount > 0 ? (
              <button className="ghost-button" type="button" onClick={resetQuiz}>
                <RotateCcw size={17} aria-hidden="true" />
                {text.restart}
              </button>
            ) : null}
          </div>

          {isNameDialogOpen ? (
            <NameDialog
              nameDraft={nameDraft}
              onChange={setNameDraft}
              onClose={() => setIsNameDialogOpen(false)}
              onSubmit={submitName}
              text={text}
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
    const resultTitle = summary.dominantColors.map((color) => resultColorLabels[language][color]).join(" / ");
    const secondaryTitle =
      summary.secondaryColors.length > 0
        ? summary.secondaryColors.map((color) => resultColorLabels[language][color]).join(" / ")
        : text.none;

    return (
      <main className="app-shell result-shell" lang={language}>
        <section className="result-layout personality-result">
          <div className="result-summary reveal-one">
            <p className="quiz-title-small">{text.result}</p>
            <h1>{text.resultTitle(participantName)}</h1>
            <p>{text.completed}</p>
          </div>

          <div
            className="personality-card reveal-two"
            style={{ "--result-accent": dominantDetail.accent } as CSSVariableStyle}
          >
            <div className="card-topline">
              <span>{text.cardResult}</span>
              <span>30 / 30</span>
            </div>
            <div className="card-identity">
              <span className="card-color-dot" aria-hidden="true" />
              <div>
                <p>{text.dominant}</p>
                <h2>{resultTitle}</h2>
              </div>
            </div>
            <div className="result-fields">
              <p>
                <span>{text.dominant}</span>
                <strong>{resultTitle}</strong>
              </p>
              <p>
                <span>{text.secondary}</span>
                <strong>{secondaryTitle}</strong>
              </p>
              <p>
                <span>{text.dominantScore}</span>
                <strong>{rankedScores[0][1]} / {questions.length}</strong>
              </p>
            </div>
          </div>

          <div className="score-panel card-score-panel reveal-two" aria-label={text.scoreDetails}>
            {rankedScores.map(([color, score], index) => (
              <div
                className="score-row card-score-row"
                key={color}
                style={{ "--score-color": resultDetails[color].accent } as CSSVariableStyle}
              >
                <div>
                  <span className="score-rank color-rank">{index + 1}</span>
                  <span>{resultColorLabels[language][color]}</span>
                </div>
                <div className="score-meter" aria-hidden="true">
                  <span style={{ width: `${Math.max((score / topScore) * 100, 4)}%` }} />
                </div>
                <strong>{text.points(score)}</strong>
              </div>
            ))}
          </div>

          <div className="result-actions reveal-three">
            <button className="primary-button" type="button" onClick={shareResultPdf} disabled={isSharingResult}>
              <Share2 size={17} aria-hidden="true" />
              {isSharingResult ? text.sharing : shareStatus || text.share}
            </button>
            <button className="primary-button" type="button" onClick={() => setReviewOpen(true)}>
              <Edit3 size={17} aria-hidden="true" />
              {text.reviewAnswers}
            </button>
            <button className="ghost-button" type="button" onClick={resetQuiz}>
              <RotateCcw size={17} aria-hidden="true" />
              {text.retake}
            </button>
          </div>

          {reviewOpen ? (
            <ReviewPanel
              answers={answers}
              onClose={() => setReviewOpen(false)}
              onEdit={editQuestion}
              questions={questions}
              text={text}
            />
          ) : null}
        </section>
      </main>
    );
  }

  const selectedAnswer = answers[currentQuestion.id];

  return (
    <main className="app-shell quiz-shell" lang={language}>
      <section className="quiz-card" aria-labelledby="question-title">
        <header className="quiz-header">
          <button className="icon-button" type="button" onClick={goBack} aria-label={text.backQuestion}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className="progress-copy">
            <span>
              {text.questionCount(currentIndex + 1, questions.length)}
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
          <p className="question-kicker">{text.choose}</p>
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
            {isAdvancing ? text.advancing : text.remaining(remainingCount)}
          </div>
          <button className="ghost-button" type="button" onClick={goBack}>
            {text.back}
          </button>
          <button className="primary-button" type="button" onClick={goNext} disabled={!selectedAnswer}>
            {allAnswered || currentIndex === questions.length - 1 ? text.viewResult : text.next}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </footer>
      </section>

      {reviewOpen ? (
        <ReviewPanel
          answers={answers}
          onClose={() => setReviewOpen(false)}
          onEdit={editQuestion}
          questions={questions}
          text={text}
        />
      ) : null}
    </main>
  );
}

function LanguagePill({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-pill" aria-label="Language">
      <button className={language === "en" ? "active" : ""} type="button" onClick={() => onChange("en")}>
        EN
      </button>
      <button className={language === "zh" ? "active" : ""} type="button" onClick={() => onChange("zh")}>
        中文
      </button>
    </div>
  );
}

function NameDialog({
  nameDraft,
  onChange,
  onClose,
  onSubmit,
  text,
}: {
  nameDraft: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  text: (typeof uiText)["en"];
}) {
  return (
    <div className="name-dialog-backdrop" role="presentation">
      <form
        className="name-dialog"
        aria-label={text.nameTitle}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <p className="quiz-title-small">{text.beforeStart}</p>
          <h2>{text.nameTitle}</h2>
          <p>{text.nameHelp}</p>
        </div>
        <label>
          <span>{text.nameLabel}</span>
          <input
            autoFocus
            maxLength={40}
            onChange={(event) => onChange(event.target.value)}
            placeholder={text.namePlaceholder}
            required
            value={nameDraft}
          />
        </label>
        <div className="name-dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            {text.back}
          </button>
          <button className="primary-button" type="submit" disabled={!nameDraft.trim()}>
            {text.start}
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
  questions,
  text,
}: {
  answers: AnswerMap;
  onClose: () => void;
  onEdit: (index: number) => void;
  questions: Question[];
  text: (typeof uiText)["en"];
}) {
  return (
    <aside className="review-panel" aria-label={text.reviewLabel}>
      <div className="review-header">
        <div>
          <p className="quiz-title-small">{text.reviewTitle}</p>
          <h2>{text.reviewSubtitle}</h2>
        </div>
        <button className="text-button" type="button" onClick={onClose}>
          {text.close}
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
                {answer ? `${answer.id}. ${answer.text}` : text.unanswered}
              </span>
              <Edit3 size={15} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
