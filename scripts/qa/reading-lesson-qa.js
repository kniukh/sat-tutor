#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

function readEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^"|"$/g, ""),
        ];
      })
  );
}

async function request(baseUrl, route, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  return {
    route,
    status: response.status,
    loadMs: Date.now() - startedAt,
    bytes: text.length,
    body,
    text,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const env = readEnv();
  const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: student, error: studentError } = await db
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", "test2")
    .single();
  if (studentError) throw studentError;

  const { data: lesson, error: lessonError } = await db
    .from("lessons")
    .select("id, name")
    .eq("id", "ca8b0e98-908b-425d-bb47-d061c595f8b0")
    .single();
  if (lessonError) throw lessonError;

  const { data: questions, error: questionError } = await db
    .from("question_bank")
    .select("id, question_type, correct_option")
    .eq("lesson_id", lesson.id)
    .eq("review_status", "approved")
    .order("display_order");
  if (questionError) throw questionError;
  assert(questions.length >= 4, "QA lesson needs at least four approved questions");

  const loginResponse = await fetch(`${baseUrl}/api/student/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_code: student.access_code }),
  });
  assert(loginResponse.ok, `Student login failed: ${loginResponse.status}`);
  const cookie = (loginResponse.headers.getSetCookie?.() || [
    loginResponse.headers.get("set-cookie"),
  ])
    .filter(Boolean)
    .map((value) => value.split(";")[0])
    .join("; ");
  const authHeaders = { "content-type": "application/json", cookie };
  const post = (route, body, authenticated = true) =>
    request(baseUrl, route, {
      method: "POST",
      headers: authenticated
        ? authHeaders
        : { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const reset = await post("/api/lesson/reset", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  assert(reset.status === 200, `Reset failed: ${reset.status}`);

  const pageResults = [];
  for (const route of [
    `/s/${student.access_code}`,
    `/s/${student.access_code}/book/7d4e24d7-6e9e-4a54-a02c-42e45da4374c`,
    `/s/${student.access_code}/lesson/${lesson.id}`,
  ]) {
    const result = await request(baseUrl, route, { headers: { cookie } });
    pageResults.push(result);
    assert(result.status === 200, `${route} returned ${result.status}`);
    assert(
      !/Application error|Internal Server Error/.test(result.text),
      `${route} rendered an application error`
    );
  }

  const unauthorizedComplete = await post(
    "/api/lesson/complete",
    { studentId: student.id, lessonId: lesson.id },
    false
  );
  assert(unauthorizedComplete.status === 401, "Unauthenticated completion was not blocked");

  const unauthorizedAdmin = await post(
    "/api/admin/lesson-status",
    { lessonId: lesson.id, status: "published" },
    false
  );
  assert(unauthorizedAdmin.status === 401, "Unauthenticated admin mutation was not blocked");

  const submitVocabulary = await post("/api/lesson/submit-vocabulary", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  assert(submitVocabulary.status === 200, "first_read → vocab_review failed");

  const skippedSecondRead = await post("/api/lesson/mark-second-read", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  assert(skippedSecondRead.status === 409, "Skipping second_read was not blocked");

  const startSecondRead = await post("/api/lesson/advance-stage", {
    studentId: student.id,
    lessonId: lesson.id,
    action: "start_second_read",
  });
  assert(startSecondRead.status === 200, "vocab_review → second_read failed");

  const finishSecondRead = await post("/api/lesson/mark-second-read", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  assert(finishSecondRead.status === 200, "second_read → questions failed");

  const invalidAnswer = await post("/api/lesson/save-question-progress", {
    studentId: student.id,
    lessonId: lesson.id,
    questionId: "qa-question-not-in-lesson",
    selectedOption: "E",
    skill: "inference",
  });
  assert(invalidAnswer.status === 400, "Invalid question/option was not blocked");

  for (const question of questions) {
    const answer = await post("/api/lesson/save-question-progress", {
      studentId: student.id,
      lessonId: lesson.id,
      questionId: question.id,
      selectedOption: question.correct_option,
      skill: "forged-skill",
    });
    assert(answer.status === 200, `Failed to save answer ${question.id}`);
  }

  const beforeAttempts = await db
    .from("lesson_attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .eq("lesson_id", lesson.id);
  const completeOnce = await post("/api/lesson/complete", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  const completeTwice = await post("/api/lesson/complete", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  assert(completeOnce.status === 200 && completeTwice.status === 200, "Completion failed");

  const afterAttempts = await db
    .from("lesson_attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .eq("lesson_id", lesson.id);
  const createdAttempts =
    Number(afterAttempts.count || 0) - Number(beforeAttempts.count || 0);
  assert(createdAttempts === 1, `Expected one attempt, created ${createdAttempts}`);

  const regressCompleted = await post("/api/lesson/submit-vocabulary", {
    studentId: student.id,
    lessonId: lesson.id,
  });
  assert(regressCompleted.status === 409, "Completed lesson regressed to vocabulary review");

  for (const sourceDocumentId of [
    "7d4e24d7-6e9e-4a54-a02c-42e45da4374c",
    "127176fd-b8fb-49dc-9bee-5efc63da4fa3",
  ]) {
    const selected = await post("/api/reading/select-book", {
      studentId: "acf51f9d-0cb5-4ede-958e-ca43637fb5e1",
      sourceDocumentId,
    });
    assert(selected.status === 200, `Could not select book ${sourceDocumentId}`);
  }

  const { data: state } = await db
    .from("student_lesson_state")
    .select("stage, question_answers_json")
    .eq("student_id", student.id)
    .eq("lesson_id", lesson.id)
    .single();
  const storedAnswers = Object.values(state.question_answers_json || {});
  assert(
    storedAnswers.every((answer) => answer.skill !== "forged-skill"),
    "Client-provided skill was trusted"
  );

  console.table(
    pageResults.map(({ route, status, loadMs, bytes }) => ({
      route,
      status,
      loadMs,
      bytes,
    }))
  );
  console.log(
    JSON.stringify(
      {
        lesson,
        checks: {
          unauthorizedComplete: unauthorizedComplete.status,
          unauthorizedAdmin: unauthorizedAdmin.status,
          skipSecondRead: skippedSecondRead.status,
          invalidAnswer: invalidAnswer.status,
          completionStatuses: [completeOnce.status, completeTwice.status],
          createdAttempts,
          completedRegression: regressCompleted.status,
          finalStage: state.stage,
          storedAnswerCount: storedAnswers.length,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
