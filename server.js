const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { v4: uuid } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const DB_FILE = "./db.json";

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* =====================
   GET SALDO
===================== */
app.get("/api/saldo", (req, res) => {
  const db = readDB();
  res.json(db.users.guest);
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
  db.users.guest.saldo += found.amount;
  writeDB(db);

  res.json({ success: true, amount: found.amount });
});

/* =====================
   GIRAR ROLETA
===================== */
app.post("/api/spin", (req, res) => {
  const items = JSON.parse(
    fs.readFileSync("./public/items.json", "utf-8")
  );

  const db = readDB();

  if (db.users.guest.saldo <= 0)
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

  // 🔥 LOG DO BACKEND
  console.log("🎯 GIRO:", {
    premio: prize.name,
    chance: prize.chance,
    totalItems: items.length
  });

  db.users.guest.saldo--;
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
  if (secret !== process.env.ADMIN_KEY)
    return res.status(403).json({ error: "Acesso negado" });

  const db = readDB();
  db.codes.push({ code, amount, used: false });
  writeDB(db);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Server rodando"));

