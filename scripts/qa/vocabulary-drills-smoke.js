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

async function main() {
  const env = readEnv();
  const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
  const maxLoadMs = Number(process.env.QA_MAX_LOAD_MS || 10_000);
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const [{ data: students, error: studentsError }, { data: items, error: itemsError }] =
    await Promise.all([
      db.from("students").select("id, access_code").eq("is_active", true),
      db
        .from("vocabulary_item_details")
        .select("student_id")
        .eq("is_removed", false)
        .limit(5000),
    ]);
  if (studentsError || itemsError) throw studentsError || itemsError;

  const counts = new Map();
  for (const item of items || []) {
    counts.set(item.student_id, (counts.get(item.student_id) || 0) + 1);
  }
  const student = [...(students || [])].sort(
    (a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0)
  )[0];
  if (!student) throw new Error("No active QA student found");

  const login = await fetch(`${baseUrl}/api/student/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_code: student.access_code }),
  });
  if (!login.ok) throw new Error(`Student login failed: ${login.status}`);
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie")])
    .filter(Boolean)
    .map((value) => value.split(";")[0])
    .join("; ");

  const routes = [
    "/s/vocabulary/drill?mode=learn_new_words",
    "/s/vocabulary/drill?mode=review_weak_words",
    "/s/vocabulary/drill?mode=mixed_practice",
    "/s/vocabulary/list",
    "/s/vocabulary/list?page=2",
    "/s/vocabulary/list?q=rest",
  ];
  const results = [];
  let failed = false;

  for (const route of routes) {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } });
    const text = await response.text();
    const result = {
      route,
      status: response.status,
      loadMs: Date.now() - startedAt,
      bytes: text.length,
      hasApplicationError: /Application error|Internal Server Error/.test(text),
    };
    results.push(result);
    if (
      result.status !== 200 ||
      result.hasApplicationError ||
      result.loadMs > maxLoadMs ||
      (route.startsWith("/s/vocabulary/list") && result.bytes > 1_000_000)
    ) {
      failed = true;
    }
  }

  const unauthorized = await fetch(`${baseUrl}/api/vocabulary/exercise-attempt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      studentId: student.id,
      result: {
        client_attempt_id: "qa-no-write",
        exercise_id: "qa",
        session_id: "qa",
      },
    }),
  });
  if (unauthorized.status !== 401) failed = true;

  const forgedExercise = await fetch(`${baseUrl}/api/vocabulary/exercise-attempt`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      studentId: student.id,
      result: {
        client_attempt_id: "qa-forged-no-write",
        exercise_id: "not-in-session",
        session_id: "not-a-real-session",
      },
    }),
  });
  if (forgedExercise.status !== 400) failed = true;

  console.table(results);
  console.log(`Unauthenticated attempt API: ${unauthorized.status}`);
  console.log(`Forged exercise API: ${forgedExercise.status}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
