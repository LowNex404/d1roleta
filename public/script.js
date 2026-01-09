const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const saldoSpan = document.getElementById("saldo");
const actions = document.getElementById("actions");

const videoOverlay = document.getElementById("videoOverlay");
const rewardVideo = document.getElementById("rewardVideo");

const isMobile = window.matchMedia("(max-width: 768px)").matches;

const videoSrc = isMobile
  ? "videos/reveal-mobile.mp4"
  : "videos/reveal.mp4";

// troca o source dinamicamente
rewardVideo.querySelector("source").src = videoSrc;
rewardVideo.load();

let items = [];
let angle = 0;
let spinning = false;
let saldo = 0;

/* =====================
   LOAD DATA
===================== */
fetch("items.json")
  .then(r => r.json())
  .then(data => {
    items = data;
    // Pré-carregar as imagens dos items
items.forEach(item => {
  const img = new Image();
  img.src = item.icon;
  images[item.name] = img; // usamos o name como chave
});

    drawWheel();
    idleSpin();
    loadSaldo();
  });

/* =====================
   BUSCAR SALDO
===================== */
async function loadSaldo() {
  const res = await fetch("/api/saldo");
  const data = await res.json();
  saldo = data.saldo;
  updateUI();
}

/* =====================
   UI
===================== */
function updateUI() {
  saldoSpan.textContent = saldo;
  actions.innerHTML = "";

if (saldo <= 0) {
  actions.innerHTML = `
    <div class="redeem-wrapper">
      <input id="codeInput" placeholder="Resgatar Código" />

      <button id="redeemBtn" aria-label="Resgatar código">
        <span class="material-symbols-outlined">
          send
        </span>
      </button>
    </div>

    <a class="whatsapp" href="https://wa.me/5573991345299" target="_blank">
      COMPRAR GIROS
    </a>
  `;
  

  document.getElementById("redeemBtn").onclick = redeemCode;
} else { const btn = document.createElement("button"); btn.textContent = "GIRAR"; btn.onclick = spin; actions.appendChild(btn); }
}

/* =====================
   VIDEO CONTROL
===================== */
function playRevealVideo(duration = 3000) {
  return new Promise(resolve => {
    videoOverlay.style.display = "block";
    rewardVideo.currentTime = 0;

    rewardVideo.play().catch(() => {
      // fallback silencioso caso autoplay falhe
    });

    setTimeout(() => {
      rewardVideo.pause();
      videoOverlay.style.display = "none";
      resolve();
    }, duration);
  });
}


/* =====================
   POPUP
===================== */
function showMessagePopup(type, title, message) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = `popup ${type}`;

  popup.innerHTML = `
    <div class="close">✖</div>
    <h2>${title}</h2>
    <p>${message}</p>
  `;

  popup.querySelector(".close").onclick = () => overlay.remove();
  overlay.onclick = e => e.target === overlay && overlay.remove();

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

/* =====================
   RESGATAR CÓDIGO
===================== */
async function redeemCode() {
  const codeValue = document.getElementById("codeInput").value.trim().toUpperCase();
  if (!codeValue) {
    showMessagePopup("aviso", "⚠️ Atenção", "Digite um código.");
    return;
  }

  const res = await fetch("/api/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codeValue })
  });

  const data = await res.json();

  if (!res.ok) {
    showMessagePopup("erro", "Erro", data.error);
    return;
  }

  showMessagePopup("sucesso", "✅ Parabéns!<br>Código resgatado com sucesso.", `+${data.amount} giros`);
  loadSaldo();
}
// Criar um objeto para armazenar imagens carregadas
const images = {};

// =====================
// DRAW WHEEL
// =====================
function drawWheel() {
  const radius = canvas.width / 2;
  const slice = (Math.PI * 2) / items.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  items.forEach((item, i) => {
    const start = angle + i * slice;
    const end = start + slice;

    // Gradiente da fatia
    const grad = ctx.createRadialGradient(radius, radius, 20, radius, radius, radius);
    grad.addColorStop(0, item.colors[0]);
    grad.addColorStop(1, item.colors[1]);

    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius, start, end);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(78, 78, 78, 1)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Desenhar texto e imagem
    ctx.save();
    ctx.translate(radius, radius);
    
    // Centraliza o texto na fatia
    const middleAngle = start + slice / 2;
    ctx.rotate(middleAngle);

    const img = images[item.name];
    const imgSize = 32;
    const textOffset = radius * 0.28; // distância do centro
    // Desenha o texto primeiro
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    // Calcula a largura do texto
const textWidth = ctx.measureText(item.name).width;
    
// Desenha o texto
ctx.fillText(item.name, textOffset, 0);

// Desenha a imagem logo após o texto
if (img.complete) {
  ctx.drawImage(img, textOffset + textWidth + 5, -imgSize / 2, imgSize, imgSize);
}


    ctx.restore();
  });
}


/* =====================
   IDLE SPIN
===================== */
function idleSpin() {
  if (!spinning) {
    angle += 0.002;
    drawWheel();
  }
  requestAnimationFrame(idleSpin);
}

/* =====================
   SPIN COM VIDEO
===================== */
async function spin() {
  if (spinning) return;
  spinning = true;

  const res = await fetch("/api/spin", { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    spinning = false;
    showMessagePopup("erro", "Erro", data.error);
    return;
  }

  console.log("🎰 GIRO:", data.prize.name);

  const index = items.findIndex(i => i.name === data.prize.name);
  const slice = (Math.PI * 2) / items.length;

  const targetAngle =
    Math.PI * 6 +
    index * slice +
    slice / 2;

  const startAngle = angle;
  const totalDuration = 5000;
  const revealAt = totalDuration - 3000; // vídeo entra 3s antes do fim
  const start = performance.now();

  let videoPlayed = false;

  function animate(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / totalDuration, 1);

    angle = startAngle + (targetAngle - startAngle) * easeOut(progress);
    drawWheel();

    // 🎥 dispara o vídeo no momento certo
    if (!videoPlayed && elapsed >= revealAt) {
      videoPlayed = true;
      playRevealVideo(3000);
      console.log("🎬 Vídeo de revelação iniciado");
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
  spinning = false;

  angle = normalizeAngle(angle); // 🔥 ESSENCIAL

  console.log("🏁 GIRO FINALIZADO:", data.prize.name);

  showMessagePopup(
    data.prize.rarity,
    `🎁 ${data.prize.name}`,
    `ID: #${String(data.spinId).padStart(5, "0")}<br>Hora: ${data.time}`
  );

  loadSaldo();
}

  }

  requestAnimationFrame(animate);
}


function normalizeAngle(a) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
