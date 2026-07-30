const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIR = path.join(ROOT, "test-results", "ui-ux-audit");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const DEBUG_PORT = 9333;

function loadEnv() {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#][^=]*)=(.*)$/);
    if (!match) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function waitForChrome() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome debugging endpoint did not start");
}

async function createTarget() {
  const response = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" }
  );
  if (!response.ok) throw new Error(`Could not create target: ${response.status}`);
  return response.json();
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let sequence = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      if (
        message.method === "Runtime.exceptionThrown" ||
        message.method === "Runtime.consoleAPICalled"
      ) {
        fs.appendFileSync(
          path.join(OUTPUT_DIR, "browser-runtime-events.jsonl"),
          `${JSON.stringify(message)}\n`
        );
      }
      return;
    }
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          sequence += 1;
          const id = sequence;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", reject);
  });
}

async function authenticateBrowser(client, session) {
  const loginPath = session === "admin" ? "/admin/login" : "/student/login";
  const apiPath = session === "admin" ? "/api/admin/login" : "/api/student/login";
  const body =
    session === "admin"
      ? {
          email: process.env.ADMIN_LOGIN_EMAIL,
          password: process.env.ADMIN_LOGIN_PASSWORD,
        }
      : { access_code: "test2" };
  await client.send("Page.navigate", { url: `${BASE_URL}${loginPath}` });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const loginResult = await client.send("Runtime.evaluate", {
    expression: `(async () => {
      const response = await fetch(${JSON.stringify(apiPath)}, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: ${JSON.stringify(JSON.stringify(body))}
      });
      return response.status;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (loginResult.result.value !== 200) {
    throw new Error(`${session} browser login returned ${loginResult.result.value}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  const authProbe = await client.send("Runtime.evaluate", {
    expression: `fetch(${JSON.stringify(
      session === "admin" ? "/api/admin/units" : "/s"
    )}).then(response => response.status)`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (authProbe.result.value !== 200) {
    throw new Error(`${session} session probe returned ${authProbe.result.value}`);
  }
}

async function capture(client, item) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: item.width,
    height: item.height,
    deviceScaleFactor: 1,
    mobile: item.width < 600,
  });
  await client.send("Network.clearBrowserCookies");
  if (item.session) {
    await authenticateBrowser(client, item.session);
  }
  await client.send("Page.navigate", { url: `${BASE_URL}${item.path}` });
  await new Promise((resolve) => setTimeout(resolve, item.waitMs ?? 2500));
  const metrics = await client.send("Page.getLayoutMetrics");
  const contentSize = metrics.cssContentSize;
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.min(contentSize.width, item.width),
      height: Math.min(contentSize.height, 6000),
      scale: 1,
    },
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${item.name}.png`), screenshot.data, "base64");

  const evaluation = await client.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      title: document.title,
      url: location.pathname,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight
      },
      bodyText: document.body.innerText.slice(0, 500),
      buttons: [...document.querySelectorAll('button')].map(x => x.innerText.trim()).filter(Boolean).slice(0, 20),
      links: [...document.querySelectorAll('a')].map(x => x.innerText.trim()).filter(Boolean).slice(0, 20),
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(x => ({
        level: Number(x.tagName.slice(1)),
        text: x.innerText.trim().slice(0, 80)
      })),
      missingInputLabels: [...document.querySelectorAll('input,select,textarea')].filter(x => {
        const id = x.getAttribute('id');
        return !x.getAttribute('aria-label') &&
          !x.getAttribute('aria-labelledby') &&
          !(id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) &&
          !x.closest('label');
      }).map(x => x.getAttribute('placeholder') || x.tagName),
      imagesMissingAlt: [...document.querySelectorAll('img')].filter(x => !x.hasAttribute('alt')).length,
      smallTouchTargets: [...document.querySelectorAll('button,a,input,select')].map(x => {
        const rect = x.getBoundingClientRect();
        return {
          text: (x.innerText || x.getAttribute('aria-label') || x.getAttribute('placeholder') || x.tagName).trim().slice(0, 60),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }).filter(x => x.width > 0 && x.height > 0 && (x.width < 44 || x.height < 44)).slice(0, 30)
    })`,
    returnByValue: true,
  });
  return JSON.parse(evaluation.result.value);
}

async function readDrillState(client) {
  const result = await client.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      url: location.pathname + location.search,
      text: document.body.innerText.slice(0, 2500),
      buttons: [...document.querySelectorAll('button')].map((button, index) => ({
        index,
        text: button.innerText.trim(),
        disabled: button.disabled,
        pressed: button.getAttribute('aria-pressed'),
        selected: button.getAttribute('data-selected'),
        className: button.className
      }))
    })`,
    returnByValue: true,
  });
  return JSON.parse(result.result.value);
}

async function clickButton(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = [...document.querySelectorAll('button')];
      const button = ${expression};
      if (!button) return false;
      button.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!result.result.value) throw new Error(`Could not click button: ${expression}`);
}

async function saveViewportScreenshot(client, name) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.png`), screenshot.data, "base64");
}

async function runVocabularyDrillJourney(client) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await client.send("Network.clearBrowserCookies");
  await authenticateBrowser(client, "student");
  await client.send("Page.navigate", {
    url: `${BASE_URL}/s/vocabulary/drill?mode=mixed_practice`,
  });
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const journey = [];
  const persistJourney = () =>
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "vocabulary-drill-journey.json"),
      JSON.stringify(journey, null, 2)
    );
  for (let exerciseIndex = 0; exerciseIndex < 10; exerciseIndex += 1) {
    const initial = await readDrillState(client);
    journey.push({ exerciseIndex: exerciseIndex + 1, phase: "initial", ...initial });
    persistJourney();

    const answerButtons = initial.buttons.filter(
      (button) =>
        !button.disabled &&
        !["Continue", "Already Know", "Finish", "Back", "Play audio"].includes(button.text) &&
        !button.text.startsWith("Play audio ") &&
        button.text.length > 0
    );
    const hasTextInput = initial.text.includes("Type the word you hear.");
    if (answerButtons.length === 0 && !hasTextInput) {
      journey.push({ exerciseIndex: exerciseIndex + 1, phase: "no-answer-control" });
      break;
    }
    const chosen = answerButtons.length > 0
      ? answerButtons[exerciseIndex % answerButtons.length]
      : null;
    let chosenText = chosen?.text ?? "qa-spelling-answer";
    if (hasTextInput) {
      const inputResult = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const input = document.querySelector('input');
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
          ).set;
          setter.call(input, 'qa-spelling-answer');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`,
        returnByValue: true,
      });
      if (!inputResult.result.value) {
        throw new Error("Could not fill spelling input");
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    } else if (initial.text.includes("Match each audio clip")) {
      const audioButtons = initial.buttons.filter((button) =>
        button.text.startsWith("Play audio ")
      );
      const matchedWords = [];
      for (const audioButton of audioButtons) {
        const word = audioButton.text.replace(/^Play audio /, "");
        await clickButton(
          client,
          `buttons.find(button => button.innerText.trim() === ${JSON.stringify(
            audioButton.text
          )})`
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
        await clickButton(
          client,
          `buttons.find(button => button.innerText.trim() === ${JSON.stringify(word)})`
        );
        await new Promise((resolve) => setTimeout(resolve, 400));
        matchedWords.push(word);
      }
      chosenText = `Matched audio: ${matchedWords.join(", ")}`;
    } else {
      await clickButton(client, `buttons[${chosen.index}]`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    let selected = await readDrillState(client);
    let continueControl = selected.buttons.find((button) =>
      ["Continue", "Finish"].includes(button.text)
    );
    if (continueControl?.disabled && !initial.text.includes("Match each audio clip")) {
      for (const extra of answerButtons.filter((button) => button.index !== chosen.index)) {
        await clickButton(client, `buttons[${extra.index}]`);
        await new Promise((resolve) => setTimeout(resolve, 150));
        selected = await readDrillState(client);
        continueControl = selected.buttons.find((button) =>
          ["Continue", "Finish"].includes(button.text)
        );
        if (continueControl && !continueControl.disabled) break;
      }
    }
    journey.push({
      exerciseIndex: exerciseIndex + 1,
      phase: "selected",
      chosenText,
      ...selected,
    });
    persistJourney();

    const enabledContinue = selected.buttons.find(
      (button) => ["Continue", "Finish"].includes(button.text) && !button.disabled
    );
    if (!enabledContinue) {
      journey.push({ exerciseIndex: exerciseIndex + 1, phase: "continue-remained-disabled" });
      persistJourney();
      break;
    }
    await clickButton(client, `buttons[${enabledContinue.index}]`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const feedback = await readDrillState(client);
    journey.push({ exerciseIndex: exerciseIndex + 1, phase: "after-submit", ...feedback });
    persistJourney();
    await saveViewportScreenshot(client, `vocabulary-drill-feedback-${exerciseIndex + 1}`);
    if (feedback.text.includes("CHECKPOINT")) {
      break;
    }

    const nextAnswerButtons = feedback.buttons.filter(
      (button) =>
        !button.disabled &&
        !["Continue", "Already Know", "Finish", "Back"].includes(button.text) &&
        button.text.length > 0
    );
    if (nextAnswerButtons.length === 0) {
      const continueButton = feedback.buttons.find(
        (button) => ["Continue", "Finish"].includes(button.text) && !button.disabled
      );
      if (!continueButton) break;
      await clickButton(client, `buttons[${continueButton.index}]`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 20_000));
  const completion = await readDrillState(client);
  journey.push({ phase: "completion", ...completion });
  await saveViewportScreenshot(client, "vocabulary-drill-completion");
  persistJourney();
  return journey;
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "sat-ui-audit-"));
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDir}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true }
  );

  try {
    await waitForChrome();
    const target = await createTarget();
    const client = await connect(target.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Network.enable");
    await client.send("Runtime.enable");

    const cases = [
      { name: "student-login-mobile", path: "/student/login", width: 390, height: 844 },
      { name: "student-dashboard-mobile", path: "/s", width: 390, height: 844, session: "student" },
      { name: "student-dashboard-desktop", path: "/s", width: 1440, height: 1000, session: "student" },
      {
        name: "student-book-mobile",
        path: "/s/book/7d4e24d7-6e9e-4a54-a02c-42e45da4374c",
        width: 390,
        height: 844,
        session: "student",
      },
      {
        name: "student-lesson-mobile",
        path: "/s/lesson/ca8b0e98-908b-425d-bb47-d061c595f8b0",
        width: 390,
        height: 844,
        session: "student",
      },
      {
        name: "student-audio-lesson-mobile",
        path: "/s/lesson/b4679e49-e878-4cf4-8fc9-5e8bde846a25",
        width: 390,
        height: 844,
        session: "student",
      },
      { name: "vocabulary-list-mobile", path: "/s/vocabulary/list", width: 390, height: 844, session: "student" },
      {
        name: "vocabulary-drill-mobile",
        path: "/s/vocabulary/drill?mode=mixed_practice",
        width: 390,
        height: 844,
        session: "student",
        waitMs: 5000,
      },
      { name: "admin-sources-desktop", path: "/admin/sources", width: 1440, height: 1000, session: "admin" },
      { name: "admin-sources-mobile", path: "/admin/sources", width: 390, height: 844, session: "admin" },
      { name: "admin-students-mobile", path: "/admin/students", width: 390, height: 844, session: "admin" },
    ];
    const results = [];
    const requestedCase = process.env.QA_UI_CASE?.trim();
    const casesToRun = process.argv.includes("--interactive-only")
      ? []
      : requestedCase
        ? cases.filter((item) => item.name === requestedCase)
        : cases;
    for (const item of casesToRun) {
      results.push({
        name: item.name,
        ...(await capture(client, item)),
      });
    }
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "capture-metrics.json"),
      JSON.stringify(results, null, 2)
    );
    if (
      process.argv.includes("--interactive-drill") ||
      process.argv.includes("--interactive-only")
    ) {
      const journey = await runVocabularyDrillJourney(client);
      console.log(JSON.stringify({ interactiveDrillSteps: journey.length }, null, 2));
    }
    client.close();
    console.log(JSON.stringify(results, null, 2));
  } finally {
    chrome.kill();
    await new Promise((resolve) => {
      chrome.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
