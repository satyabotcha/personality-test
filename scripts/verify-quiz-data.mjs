import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const rootDir = process.cwd();
const questionIds = Array.from({ length: 30 }, (_, index) => index + 1);
const answerIds = ["A", "B", "C", "D"];

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function objectProperty(objectLiteral, key) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    if (propertyNameText(property.name) === key) {
      return property.initializer;
    }
  }

  throw new Error(`Missing property ${key}`);
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  throw new Error(`Expected literal, got ${ts.SyntaxKind[node.kind]}`);
}

function findExportedArray(sourceFile, exportName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) {
        let initializer = declaration.initializer;

        if (initializer && ts.isAsExpression(initializer)) {
          initializer = initializer.expression;
        }

        if (initializer && ts.isArrayLiteralExpression(initializer)) {
          return initializer;
        }
      }
    }
  }

  throw new Error(`Could not find exported array ${exportName}`);
}

function parseQuestionFile(relativePath, exportName) {
  const filePath = path.join(rootDir, relativePath);
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const arrayLiteral = findExportedArray(sourceFile, exportName);

  return arrayLiteral.elements.map((questionNode) => {
    assert(ts.isObjectLiteralExpression(questionNode), `${relativePath} contains a non-object question`);

    const answers = objectProperty(questionNode, "answers");
    assert(ts.isArrayLiteralExpression(answers), `${relativePath} question answers must be an array`);

    return {
      id: Number(literalText(objectProperty(questionNode, "id"))),
      prompt: literalText(objectProperty(questionNode, "prompt")),
      answers: answers.elements.map((answerNode) => {
        assert(ts.isObjectLiteralExpression(answerNode), `${relativePath} contains a non-object answer`);

        return {
          id: literalText(objectProperty(answerNode, "id")),
          text: literalText(objectProperty(answerNode, "text")),
        };
      }),
    };
  });
}

function decodeXmlText(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function parseReferenceDocx() {
  const documentXml = execFileSync("unzip", ["-p", path.join(rootDir, "test_reference.docx"), "word/document.xml"], {
    encoding: "utf8",
  });
  const paragraphs = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map(([paragraph]) =>
      [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map(([, text]) => decodeXmlText(text))
        .join("")
        .trim(),
    )
    .filter(Boolean);

  const questions = [];
  let currentQuestion = null;

  for (const paragraph of paragraphs) {
    const questionMatch = paragraph.match(/^(\d+)\s*[、.]\s*(.+)$/);

    if (questionMatch) {
      currentQuestion = {
        id: Number(questionMatch[1]),
        prompt: questionMatch[2],
        answers: [],
      };
      questions.push(currentQuestion);
      continue;
    }

    const answerMatch = paragraph.match(/^([ABCD])\s*、\s*(.+)$/);

    if (answerMatch && currentQuestion) {
      currentQuestion.answers.push({
        id: answerMatch[1],
        text: answerMatch[2],
      });
    }
  }

  return questions;
}

function assertQuestionShape(label, questions) {
  assert.deepEqual(
    questions.map((question) => question.id),
    questionIds,
    `${label} question ids must be ordered 1-30`,
  );

  for (const question of questions) {
    assert.equal(question.prompt.trim().length > 0, true, `${label} question ${question.id} prompt is empty`);
    assert.deepEqual(
      question.answers.map((answer) => answer.id),
      answerIds,
      `${label} question ${question.id} answer ids must be ordered A-D`,
    );
    question.answers.forEach((answer) => {
      assert.equal(answer.text.trim().length > 0, true, `${label} question ${question.id}${answer.id} is empty`);
    });
  }
}

function assertSameQuestionAndAnswerOrder(leftLabel, leftQuestions, rightLabel, rightQuestions) {
  assert.deepEqual(
    leftQuestions.map((question) => question.id),
    rightQuestions.map((question) => question.id),
    `${leftLabel} and ${rightLabel} question order differs`,
  );

  for (const [index, leftQuestion] of leftQuestions.entries()) {
    const rightQuestion = rightQuestions[index];
    assert.deepEqual(
      leftQuestion.answers.map((answer) => answer.id),
      rightQuestion.answers.map((answer) => answer.id),
      `${leftLabel} and ${rightLabel} answer order differs for question ${leftQuestion.id}`,
    );
  }
}

function assertScoringFormula() {
  const scoringSource = readFileSync(path.join(rootDir, "lib/scoring.ts"), "utf8");
  const expectedSnippets = [
    /const firstHalfMap:[\s\S]*A:\s*"red"[\s\S]*B:\s*"blue"[\s\S]*C:\s*"yellow"[\s\S]*D:\s*"green"/,
    /const secondHalfMap:[\s\S]*A:\s*"green"[\s\S]*B:\s*"yellow"[\s\S]*C:\s*"blue"[\s\S]*D:\s*"red"/,
    /questionId\s*<=\s*15\s*\?\s*firstHalfMap\[answerId\]\s*:\s*secondHalfMap\[answerId\]/,
  ];

  expectedSnippets.forEach((snippet) => {
    assert.match(scoringSource, snippet, "Scoring formula must match the reference calculation");
  });
}

const referenceQuestions = parseReferenceDocx();
const zhQuestions = parseQuestionFile("data/questions.ts", "questions");
const enQuestions = parseQuestionFile("data/questions.en.ts", "enQuestions");

assertQuestionShape("Reference DOCX", referenceQuestions);
assertQuestionShape("Chinese data", zhQuestions);
assertQuestionShape("English data", enQuestions);
assertSameQuestionAndAnswerOrder("Reference DOCX", referenceQuestions, "Chinese data", zhQuestions);
assertSameQuestionAndAnswerOrder("Chinese data", zhQuestions, "English data", enQuestions);
assertScoringFormula();

console.log("Quiz data verified: reference, Chinese, English, and scoring formula are aligned.");
