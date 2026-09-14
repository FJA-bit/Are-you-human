
import express from "express";
import path from "path";
import crypto from "crypto";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

const app = express();
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 5000;

/* ───── Types ───── */
type Level = { id: number; name: string; seconds: number };
type CaptchaChallenge = { id: string; answer: string; hint: string };
type Session = {
  startedAt: number; remaining: number; currentLevel: number; retries: number[];
  challenges: CaptchaChallenge[]; challengeIndex: number; levelStartedAt: number;
  failed: boolean; completed: boolean;
};

/* ───── Config ───── */
const LEVELS: Level[] = [
  { id: 0, name: "EASY", seconds: 30 },
  { id: 1, name: "MEDIUM", seconds: 45 },
  { id: 2, name: "HARD", seconds: 60 },
  { id: 3, name: "EXTRA HARD", seconds: 70 },
  { id: 4, name: "COMPLEX", seconds: 80 },
];
const GLOBAL_LIMIT = 600, RETRY_PENALTY = 60;
const sessions = new Map<string, Session>();

/* ───── Utilities ───── */
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } return x; };
const uid = () => crypto.randomUUID();
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/* ───── Sentence pools per level ───── */
const SENTENCES: string[][] = [
  // Level 0 — EASY: simple lowercase phrases
  [
    "the cat sat on the mat",
    "hello world from earth",
    "open the green door now",
    "five birds on the fence",
    "blue sky and white clouds",
    "run fast jump higher fly",
    "the quick red fox leapt",
    "good morning sunny day",
    "play the music out loud",
    "warm coffee and fresh bread",
  ],
  // Level 1 — MEDIUM: mixed case + numbers
  [
    "Order 42 ships by Friday",
    "Room 7B on the 3rd floor",
    "Call Agent 9 at noon today",
    "Mix 250ml with 3 spoons",
    "Train leaves at platform 4",
    "Score was 87 to 64 final",
    "Page 12 paragraph 3 line 8",
    "Buy 6 apples and 2 lemons",
    "Flight 901 departs Gate C5",
    "Send Report 14 by 5pm sharp",
  ],
  // Level 2 — HARD: technical sentences with mixed case
  [
    "Upload config.dat to srv02",
    "Error 503 on node alpha7",
    "Patch build v3.8.1 is live",
    "Query SELECT from Table9x",
    "Deploy branch rc4 to stage",
    "Hash md5 output 9fa3bc01",
    "Module init port 8443 ok",
    "Sync repo delta with main",
    "Token exp 2026 renew fast",
    "Cache miss rate 12.4 pct",
  ],
  // Level 3 — EXTRA HARD: symbols + mixed case
  [
    "Access#Code: Zq8!mN",
    "Key= xR4$pL7&wQ",
    "Pass: nB3@kT9!yF",
    "Auth [mX5] => {vJ2}",
    "Pin#7492 & Tok$83",
    "Verify: aQ1!bR2@cS",
    "Lock{D4} Open(E9)k",
    "Sig: hN6$wP3#zM8",
    "Cert [xK2&jL5!mR]",
    "API_key: f8G#n2Y!q",
  ],
  // Level 4 — COMPLEX: long mixed strings with heavy symbols
  [
    "xA9$kL2@mP7&wQ4#bZ",
    "Rz3!Tf8#Hn1$Wp6&Jv",
    "q5Y@e2K!u8M#i4G$o7",
    "Bc6&Nx9!Ls3@Dt7#Fg",
    "hW1$rJ4&mV8!pZ2@kY",
    "Ue5#Qa9$Io3&Cg7!Xn",
    "tF2@Lk6#Rp1$Hs8&Wj",
    "Ov4!Bn7@Yd3#Mz9$Ec",
    "sG8&Jx5!Aq2@Ul6#Pi",
    "Nw3$Ft1&Hm7!Kb9@Zr",
  ],
];

/* ───── Generate challenges for a level ───── */
function generateChallenges(level: number): CaptchaChallenge[] {
  const pool = SENTENCES[level];
  const count = level <= 1 ? 2 : 3; // easier levels = fewer challenges
  const selected = shuffle(pool).slice(0, count);
  return selected.map(answer => ({
    id: uid(),
    answer,
    hint: level <= 1 ? "Type exactly what you see (case-sensitive)" :
      level <= 2 ? "Type exactly — watch for numbers and dots" :
        level <= 3 ? "Type exactly — symbols and case matter" :
          "Type the exact string — every character counts",
  }));
}

/* ───── CAPTCHA Image Renderer ───── */
function renderCaptcha(text: string, level: number): Buffer {
  const W = 720, H = 200;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background
  const bgColors = ["#f0f4f8", "#e8edf3", "#dfe6ee", "#d0d9e4", "#c2cdd9"];
  ctx.fillStyle = bgColors[level];
  ctx.fillRect(0, 0, W, H);

  // Background noise — dots
  const dotCount = [40, 100, 200, 350, 500][level];
  for (let i = 0; i < dotCount; i++) {
    ctx.beginPath();
    ctx.arc(randInt(0, W), randInt(0, H), randInt(1, 3 + level), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${randInt(0, 360)}, 40%, 60%, ${0.15 + level * 0.08})`;
    ctx.fill();
  }

  // Background noise — lines
  const lineCount = [2, 5, 10, 18, 28][level];
  for (let i = 0; i < lineCount; i++) {
    ctx.beginPath();
    ctx.moveTo(randInt(0, W), randInt(0, H));
    ctx.lineTo(randInt(0, W), randInt(0, H));
    ctx.strokeStyle = `hsla(${randInt(0, 360)}, 50%, 50%, ${0.12 + level * 0.06})`;
    ctx.lineWidth = randInt(1, 2 + level);
    ctx.stroke();
  }

  // Bezier curve noise for higher levels
  if (level >= 2) {
    const curveCount = [0, 0, 4, 8, 14][level];
    for (let i = 0; i < curveCount; i++) {
      ctx.beginPath();
      ctx.moveTo(randInt(0, W), randInt(0, H));
      ctx.bezierCurveTo(
        randInt(0, W), randInt(0, H),
        randInt(0, W), randInt(0, H),
        randInt(0, W), randInt(0, H)
      );
      ctx.strokeStyle = `hsla(${randInt(0, 360)}, 60%, 45%, ${0.15 + level * 0.05})`;
      ctx.lineWidth = randInt(1, 3);
      ctx.stroke();
    }
  }

  // Text rendering
  const fontSize = level <= 1 ? 36 : level <= 2 ? 32 : level <= 3 ? 30 : 28;
  const fontFamily = "Arial, Helvetica, sans-serif";

  // Measure total text width to center it
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const totalWidth = ctx.measureText(text).width;
  let x = Math.max(20, (W - totalWidth) / 2);
  const baseY = H / 2 + fontSize / 3;

  // Draw each character with per-level distortions
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.save();

    // Per-character font size variation
    const sizeJitter = level >= 2 ? randInt(-3, 3) : 0;
    const charSize = fontSize + sizeJitter;
    ctx.font = `bold ${charSize}px ${fontFamily}`;

    // Per-character rotation
    const maxRot = [0, 0.03, 0.08, 0.15, 0.25][level];
    const rotation = (Math.random() - 0.5) * 2 * maxRot;

    // Per-character vertical offset (wave effect)
    const waveAmp = [0, 2, 5, 10, 16][level];
    const yOffset = Math.sin(i * 0.7 + Math.random()) * waveAmp;

    // Per-character color
    const hue = level <= 1
      ? randInt(200, 240)  // blues
      : randInt(0, 360);   // rainbow chaos
    const lightness = level <= 2 ? randInt(15, 30) : randInt(10, 40);
    const saturation = level <= 1 ? randInt(60, 80) : randInt(40, 90);
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    ctx.translate(x, baseY + yOffset);
    ctx.rotate(rotation);

    // Shadow for depth on harder levels
    if (level >= 3) {
      ctx.shadowColor = `hsla(0, 0%, 0%, ${0.1 + level * 0.05})`;
      ctx.shadowBlur = randInt(2, 5);
      ctx.shadowOffsetX = randInt(-2, 2);
      ctx.shadowOffsetY = randInt(-2, 2);
    }

    ctx.fillText(char, 0, 0);

    // Strikethrough effect on highest levels
    if (level >= 4 && Math.random() > 0.6) {
      ctx.beginPath();
      ctx.moveTo(-2, -charSize * 0.3);
      ctx.lineTo(ctx.measureText(char).width + 2, -charSize * 0.3 + randInt(-3, 3));
      ctx.strokeStyle = `hsla(${randInt(0, 360)}, 50%, 50%, 0.3)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();

    const charWidth = ctx.measureText(char).width;
    const kerning = level >= 3 ? randInt(-2, 3) : 0;
    x += charWidth + kerning;
  }

  // Foreground noise overlay for harder levels
  if (level >= 3) {
    const fgDots = [0, 0, 0, 60, 120][level];
    for (let i = 0; i < fgDots; i++) {
      ctx.beginPath();
      ctx.arc(randInt(0, W), randInt(0, H), randInt(1, 2), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${randInt(0, 360)}, 30%, 40%, 0.25)`;
      ctx.fill();
    }
  }

  return Buffer.from(canvas.toBuffer("image/png"));
}

/* ───── Session helpers ───── */
function elapsed(s: Session) { return Math.floor((Date.now() - s.startedAt) / 1000); }
function levelElapsed(s: Session) { return Math.floor((Date.now() - s.levelStartedAt) / 1000); }
function totalRemaining(s: Session) { return Math.max(0, s.remaining - elapsed(s)); }
function levelRemaining(s: Session) { return Math.max(0, LEVELS[s.currentLevel].seconds - levelElapsed(s)); }

function status(s: Session) {
  const rem = totalRemaining(s);
  if (rem <= 0) s.failed = true;
  return {
    level: s.currentLevel, levelName: LEVELS[s.currentLevel].name,
    levelLimit: LEVELS[s.currentLevel].seconds,
    levelRemaining: Math.min(levelRemaining(s), rem), totalRemaining: rem,
    retries: s.retries,
    questionNumber: s.challengeIndex + 1, totalQuestions: s.challenges.length,
    failed: s.failed, completed: s.completed,
  };
}

function publicChallenge(c: CaptchaChallenge, token: string) {
  return { id: c.id, hint: c.hint, captchaUrl: `/api/captcha/${token}` };
}

/* ───── Express setup ───── */
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

/* ───── CAPTCHA image endpoint ───── */
app.get("/api/captcha/:token", (req, res) => {
  const s = sessions.get(req.params.token);
  if (!s) return res.status(404).send("Not found");
  if (s.failed || s.completed) return res.status(400).send("Session inactive");
  const challenge = s.challenges[s.challengeIndex];
  if (!challenge) return res.status(404).send("No challenge");
  const png = renderCaptcha(challenge.answer, s.currentLevel);
  res.set({ "Content-Type": "image/png", "Cache-Control": "no-store" });
  res.send(png);
});

/* ───── Start session ───── */
app.post("/api/start", (_req, res) => {
  const token = uid(), now = Date.now();
  const s: Session = {
    startedAt: now, remaining: GLOBAL_LIMIT, currentLevel: 0, retries: [0, 0, 0, 0, 0],
    challenges: generateChallenges(0), challengeIndex: 0, levelStartedAt: now,
    failed: false, completed: false,
  };
  sessions.set(token, s);
  res.json({ token, ...status(s), challenge: publicChallenge(s.challenges[0], token) });
});

/* ───── Submit answer ───── */
app.post("/api/answer", (req, res) => {
  const s = sessions.get(req.body?.token);
  if (!s) return res.status(401).json({ error: "Session expired. Start again." });
  if (s.failed || s.completed) return res.status(400).json({ error: "This session is no longer active.", ...status(s) });
  const st = status(s);
  if (st.totalRemaining <= 0 || st.levelRemaining <= 0) return res.status(408).json({ error: "Time expired.", ...status(s) });

  const challenge = s.challenges[s.challengeIndex];
  const userAnswer = String(req.body?.answer ?? "").trim();
  const correct = userAnswer === challenge.answer;

  if (!correct) {
    s.failed = true;
    return res.json({ correct: false, reason: "Incorrect CAPTCHA. Restart required.", ...status(s) });
  }

  s.challengeIndex++;
  if (s.challengeIndex >= s.challenges.length) {
    if (s.currentLevel === 4) {
      s.completed = true;
      return res.json({ correct: true, complete: true, reward: "🤖 HUMAN VERIFICATION COMPLETE", key: "R", ...status(s) });
    }
    s.currentLevel++;
    s.challenges = generateChallenges(s.currentLevel);
    s.challengeIndex = 0;
    s.levelStartedAt = Date.now();
  }
  res.json({ correct: true, complete: false, ...status(s), challenge: publicChallenge(s.challenges[s.challengeIndex], req.body.token) });
});

/* ───── Retry level ───── */
app.post("/api/retry", (req, res) => {
  const s = sessions.get(req.body?.token);
  if (!s) return res.status(401).json({ error: "Session expired." });
  if (!s.failed) return res.status(400).json({ error: "Retry is only available after a failed level." });
  const before = totalRemaining(s);
  if (before <= RETRY_PENALTY) return res.status(400).json({ error: "Not enough global time left to retry this level.", ...status(s) });
  s.remaining = before - RETRY_PENALTY;
  s.failed = false;
  s.challenges = generateChallenges(s.currentLevel);
  s.challengeIndex = 0;
  s.levelStartedAt = Date.now();
  s.retries[s.currentLevel]++;
  res.json({ message: "Level restarted. 60-second penalty applied.", ...status(s), challenge: publicChallenge(s.challenges[0], req.body.token) });
});

/* ───── Full restart ───── */
app.post("/api/restart", (req, res) => {
  const old = sessions.get(req.body?.token);
  if (old) sessions.delete(req.body.token);
  const token = uid(), now = Date.now();
  const s: Session = {
    startedAt: now, remaining: GLOBAL_LIMIT, currentLevel: 0, retries: [0, 0, 0, 0, 0],
    challenges: generateChallenges(0), challengeIndex: 0, levelStartedAt: now,
    failed: false, completed: false,
  };
  sessions.set(token, s);
  res.json({ token, ...status(s), challenge: publicChallenge(s.challenges[0], token) });
});

/* ───── Config ───── */
app.get("/api/config", (_req, res) => res.json({ levels: LEVELS, globalLimit: GLOBAL_LIMIT, retryPenalty: RETRY_PENALTY }));

app.listen(PORT, HOST, () => console.log(`Are You Human? verifier: http://${HOST}:${PORT}`));

