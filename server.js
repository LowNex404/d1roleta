const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");

function generateId() {
  return crypto.randomUUID();
}

require("dotenv").config(); // 🔹 Carrega as variáveis do .env
const cookieParser = require("cookie-parser");

const app = express();

app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.static("public"));

const DB_FILE = "./db.json";

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Cria um id, ou pega o existente.
function getUser(req, res, db) {
  let userId = req.cookies.userId;

  if (!userId) {
    userId = crypto.randomUUID();
    res.cookie("userId", userId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 365 // 1 ano
    });
  }

  if (!db.users[userId]) {
    db.users[userId] = { saldo: 0 };
  }

  return db.users[userId];
}


/* =====================
   GET SALDO
===================== */
app.get("/api/saldo", (req, res) => {
  const db = readDB();
  const user = getUser(req, res, db);
res.json(user);

});

/* =====================
   RESGATAR CÓDIGO
===================== */
app.post("/api/redeem", (req, res) => {
  const { code } = req.body;
  const db = readDB();

  const found = db.codes.find(c => c.code === code);
  if (!found) return res.status(400).json({ error: "Código inválido" });
  if (found.used) return res.status(400).json({ error: "Código já usado" });

  found.used = true;
  const user = getUser(req, res, db);
user.saldo += found.amount;

  writeDB(db);

  res.json({ success: true, amount: found.amount });
});

/* =====================
   GIRAR ROLETA
===================== */
app.post("/api/spin", (req, res) => {
  const items = JSON.parse(fs.readFileSync("./public/items.json", "utf-8"));
  const db = readDB();

  // 🔹 usuário individual por cookie
  const user = getUser(req, res, db);

  if (user.saldo <= 0)
    return res.status(400).json({ error: "Sem giros" });

  const total = items.reduce((s, i) => s + i.chance, 0);
  let r = Math.random() * total;
  let prize;

  for (const item of items) {
    r -= item.chance;
    if (r <= 0) {
      prize = item;
      break;
    }
  }

  console.log("🎯 GIRO:", {
    userId: req.cookies.userId, // opcional, só pra debug
    premio: prize.name,
    chance: prize.chance,
    totalItems: items.length
  });

  // 🔹 desconta SOMENTE do usuário atual
  user.saldo--;
  db.spins++;

  writeDB(db);

  res.json({
    prize,
    spinId: db.spins,
    time: new Date().toLocaleTimeString("pt-BR")
  });
});

/* =====================
   ADMIN - ADICIONAR CÓDIGO
===================== */
app.post("/api/admin/add-code", (req, res) => {
  const { code, amount, secret } = req.body;

  // 🔹 Verifica a chave do .env
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY não definida no servidor" });
  }

  if (secret !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Acesso negado" });
  }

  const db = readDB();
  db.codes.push({ code, amount, used: false });
  writeDB(db);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Server rodando na porta ${PORT}`));
