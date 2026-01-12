import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { QUESTIONS } from "./questions-bank.js";
import { db, initDB } from "./db.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await initDB();

app.use(express.json({ limit: "1mb" }));

// Serve frontend static (index.html, css, js) ngay trên Koyeb
app.use(express.static(__dirname));

app.get("/health", (req, res) => res.send("ok"));

function pickQuestion(level, excludeSet) {
  const pool = QUESTIONS.filter(
    (q) => q.level === level && !excludeSet.has(q.id)
  );
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Lấy 1 câu theo level, tránh trùng (exclude=id1,id2,...)
app.get("/api/question", (req, res) => {
  const level = String(req.query.level || "").toLowerCase(); // easy|medium|hard
  const exclude = String(req.query.exclude || "")
    .split(",")
    .filter(Boolean);
  const excludeSet = new Set(exclude);

  if (!["easy", "medium", "hard"].includes(level)) {
    return res.status(400).json({ error: "level must be easy|medium|hard" });
  }

  const q = pickQuestion(level, excludeSet);
  if (!q) return res.json({ done: true });

  res.json({
    done: false,
    question: { id: q.id, level: q.level, q: q.q, choices: q.choices },
  });
});

// Chấm đáp án (server giữ đáp án)
app.post("/api/grade", (req, res) => {
  const { id, choice } = req.body || {};
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) return res.status(404).json({ error: "question not found" });

  const pick = String(choice || "").toUpperCase();
  const correct = pick === q.answer;

  res.json({
    correct,
    answer: q.answer,
    explain: q.explain || "",
  });
});

// Nộp điểm
app.post("/api/submit", async (req, res) => {
  const { name, score, correct, total, durationMs, mode } = req.body || {};
  const cleanName = String(name || "Ẩn danh").slice(0, 32);

  const entry = {
    id: nanoid(10),
    name: cleanName,
    mode: String(mode || "practice").slice(0, 12), // practice|exam
    score: Number(score || 0),
    correct: Number(correct || 0),
    total: Number(total || 0),
    durationMs: Number(durationMs || 0),
    ts: Date.now(),
  };

  db.data.scores.push(entry);
  if (db.data.scores.length > 500) db.data.scores = db.data.scores.slice(-500);
  await db.write();

  res.json({ ok: true, entry });
});

// Leaderboard
app.get("/api/leaderboard", (req, res) => {
  const limit = Math.min(50, Math.max(5, Number(req.query.limit || 20)));
  const mode = String(req.query.mode || "exam").slice(0, 12);

  const list = [...db.data.scores]
    .filter((x) => x.mode === mode)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.durationMs - b.durationMs;
    })
    .slice(0, limit);

  res.json({ list });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on", port));
