// ============================================================
// যুক্তবর্ণ ভাঙো - গেম লজিক (সাধারণ ওয়েব ভার্সন)
// ============================================================
// ডেটা আসে data/words.json (পূর্ণ যুক্তবর্ণ শব্দ) ও
// data/broken.json (সঠিক ভাঙা রূপ, শব্দ-কী দিয়ে ম্যাপ করা) থেকে।
// এই দুটো ফাইল আপনি নিজে এডিট করে শব্দ যোগ/বাদ দিতে পারবেন।
//
// এই ভার্সনটা GitHub Pages/Netlify এর মতো সাধারণ ওয়েব হোস্টিং-এর
// জন্য বানানো (Facebook Instant Games SDK ছাড়া), যাতে Business
// Verification/ডোমেইন ছাড়াই ফ্রিতে লাইভ করা যায়।
// ============================================================

const GAME_DURATION = 120; // সেকেন্ড
const FEEDBACK_DELAY_MS = 900; // সঠিক/ভুল দেখানোর পর পরের শব্দে যাওয়ার আগে বিরতি

let allWords = [];
let brokenMap = {};
let pool = []; // এই রাউন্ডে এখনো না-দেখানো শব্দের তালিকা (শেষ হলে আবার শাফল হয়)
let currentWord = null;

let winCount = 0;
let failCount = 0;
let timeLeft = GAME_DURATION;
let timerInterval = null;
let gameActive = false;
let audioCtx = null;

// ============================================================
// ধাপ ১: JSON ডেটা লোড করা
// ============================================================
async function loadData() {
  const fill = document.getElementById("loadingFill");
  if (fill) fill.style.width = "60%"; // ডেটা লোড হওয়া শুরু হচ্ছে বোঝানোর জন্য
  try {
    const [wordsRes, brokenRes] = await Promise.all([
      fetch("words.json"),
      fetch("broken.json"),
    ]);
    const wordsData = await wordsRes.json();
    brokenMap = await brokenRes.json();
    allWords = wordsData.words || [];

    // যেসব শব্দ words.json এ আছে কিন্তু broken.json এ ভাঙা রূপ নেই,
    // সেগুলো গেম থেকে বাদ দেওয়া হচ্ছে (ভুল কনফিগারেশন এড়াতে)
    allWords = allWords.filter((w) => brokenMap[w]);

    showScreen("startScreen");
  } catch (err) {
    console.error("ডেটা লোড করতে সমস্যা হয়েছে:", err);
    document.getElementById("loadingScreen").innerHTML =
      '<div class="instruction">শব্দ তালিকা লোড করা যায়নি। data/words.json ও data/broken.json ফাইল ঠিকভাবে আছে কিনা চেক করুন।</div>';
  }
}

// ============================================================
// স্ক্রিন সুইচ করা
// ============================================================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// ============================================================
// ধাপ ৩: গেম শুরু/রিসেট
// ============================================================
function startGame() {
  winCount = 0;
  failCount = 0;
  timeLeft = GAME_DURATION;
  gameActive = true;
  pool = [];

  updateStatsUI();
  showScreen("gameScreen");
  nextWord();
  startTimer();
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// ধাপ ৪: র‍্যান্ডম পরবর্তী শব্দ দেখানো
// ------------------------------------------------------------
// pool খালি হয়ে গেলে আবার সব শব্দ শাফল করে নতুন pool বানানো হয়,
// তাই সব শব্দ ব্যবহৃত না হওয়া পর্যন্ত একই শব্দ বারবার আসবে না।
// ============================================================
function nextWord() {
  if (!gameActive) return;

  if (pool.length === 0) {
    pool = shuffleArray(allWords);
  }
  currentWord = pool.pop();

  document.getElementById("wordDisplay").textContent = currentWord;
  const input = document.getElementById("answerInput");
  input.value = "";
  input.focus();

  hideFeedback();
}

// ============================================================
// ধাপ ৫: ইউজারের উত্তর মিলিয়ে দেখা
// ------------------------------------------------------------
// হাইফেন (-) বা স্পেস, দুটো দিয়েই আলাদা করা যায় - তুলনার আগে
// দুটো ফরম্যাটকেই স্বাভাবিক (normalize) করে নেওয়া হয়, যাতে অতিরিক্ত
// স্পেস বা হাইফেনের কারণে ভুলভাবে "ভুল" না দেখায়।
// ============================================================
function normalize(str) {
  return str
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean)
    .join(",");
}

function submitAnswer() {
  if (!gameActive) return;
  const input = document.getElementById("answerInput");
  const userAnswer = normalize(input.value);
  const correctAnswer = normalize(brokenMap[currentWord] || "");

  if (userAnswer.length === 0) return; // খালি রেখে সাবমিট করলে কিছু হবে না

  if (userAnswer === correctAnswer) {
    handleResult(true);
  } else {
    handleResult(false);
  }
}

function handleResult(isCorrect) {
  gameActive = false; // ফিডব্যাক দেখানোর সময় ইনপুট লক থাকবে

  if (isCorrect) {
    winCount++;
    playCorrectSound();
    showFeedback(true);
  } else {
    failCount++;
    playFailSound();
    showFeedback(false);
  }
  updateStatsUI();

  setTimeout(() => {
    gameActive = true;
    if (timeLeft > 0) {
      nextWord();
    }
  }, FEEDBACK_DELAY_MS);
}

function updateStatsUI() {
  document.getElementById("winValue").textContent = bn(winCount);
  document.getElementById("failValue").textContent = bn(failCount);
  document.getElementById("timerValue").textContent = bn(timeLeft);
}

// ============================================================
// ধাপ ৬: ফিডব্যাক এনিমেশন (✅ সঠিক / ❌ ভুল)
// ============================================================
function showFeedback(isCorrect) {
  const overlay = document.getElementById("feedbackOverlay");
  const icon = document.getElementById("feedbackIcon");
  const text = document.getElementById("feedbackText");

  overlay.classList.remove("hidden", "win", "fail");
  overlay.classList.add(isCorrect ? "win" : "fail");
  icon.textContent = isCorrect ? "✅" : "❌";
  text.textContent = isCorrect ? "সঠিক!" : "ভুল হয়েছে!";
}

function hideFeedback() {
  document.getElementById("feedbackOverlay").classList.add("hidden");
}

// ============================================================
// ধাপ ৭: সাউন্ড এফেক্ট (Web Audio API দিয়ে তৈরি, আলাদা কোনো
// অডিও ফাইল লাগে না - তাই হোস্টিং সহজ থাকে)
// ============================================================
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = "sine") {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    /* কিছু ব্রাউজারে ইউজার ইন্টারঅ্যাকশনের আগে অডিও চালু হয় না, নিরাপদে ইগনোর করা হচ্ছে */
  }
}

function playCorrectSound() {
  playTone(660, 0.12);
  setTimeout(() => playTone(880, 0.15), 100);
}

function playFailSound() {
  playTone(180, 0.25, "sawtooth");
}

// ============================================================
// ধাপ ৮: কাউন্টডাউন টাইমার (১২০ সেকেন্ড)
// ============================================================
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateStatsUI();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

// ============================================================
// ধাপ ৯: গেম শেষ - সারাংশ দেখানো
// ============================================================
function endGame() {
  gameActive = false;
  document.getElementById("resultTotal").textContent = bn(winCount + failCount);
  document.getElementById("resultWin").textContent = bn(winCount);
  document.getElementById("resultFail").textContent = bn(failCount);
  showScreen("endScreen");
}

// ============================================================
// বাংলা সংখ্যায় রূপান্তর
// ============================================================
function bn(num) {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((c) => (c >= "0" && c <= "9" ? digits[c] : c))
    .join("");
}

// ============================================================
// ধাপ ১০: স্কোর-কার্ড ইমেজ তৈরি করা (Canvas দিয়ে)
// ------------------------------------------------------------
// "১২০ সেকেন্ডে X টি শব্দ সঠিক করেছি" - এই তথ্যটা একটা ছবি হিসেবে
// বানানো হচ্ছে, যাতে শেয়ার করলে বন্ধুদের ফিডে শুধু লেখা না, একটা
// দেখতে ভালো কার্ড দেখা যায় - এতে বেশি মানুষ ক্লিক করে গেমটা খেলতে
// আগ্রহী হয়।
// ============================================================
function generateScoreCardImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  // ব্যাকগ্রাউন্ড গ্র্যাডিয়েন্ট
  const bg = ctx.createRadialGradient(400, 200, 50, 400, 400, 600);
  bg.addColorStop(0, "#1c3a52");
  bg.addColorStop(1, "#0c1b2a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 800, 800);

  ctx.textAlign = "center";

  // লোগো/টাইটেল
  ctx.fillStyle = "#f2b84b";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText("✦ যুক্তবর্ণ ভাঙো ✦", 400, 130);

  // মূল স্ট্যাট কার্ড
  ctx.fillStyle = "#142c3f";
  roundRect(ctx, 100, 220, 600, 400, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,184,75,0.4)";
  ctx.lineWidth = 3;
  roundRect(ctx, 100, 220, 600, 400, 24);
  ctx.stroke();

  // সময়ের ভেতরে যে সংখ্যক শব্দ সঠিক হয়েছে
  ctx.fillStyle = "#93a5b8";
  ctx.font = "28px sans-serif";
  ctx.fillText(`${GAME_DURATION} সেকেন্ডে`, 400, 300);

  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 130px sans-serif";
  ctx.fillText(bn(winCount), 400, 460);

  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("টি শব্দ সঠিক করেছি!", 400, 540);

  ctx.fillStyle = "#93a5b8";
  ctx.font = "22px sans-serif";
  ctx.fillText(`মোট ${bn(winCount + failCount)} বার চেষ্টা করেছি`, 400, 590);

  // নিচে চ্যালেঞ্জ টেক্সট
  ctx.fillStyle = "#2dd4bf";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("তুমি কি আমাকে হারাতে পারবে?", 400, 700);

  return canvas.toDataURL("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============================================================
// ধাপ ১১: Facebook-এ স্কোর শেয়ার করা (ছবি + টেক্সট দুটোই সহ)
// ============================================================
// ============================================================
// ধাপ ১১: স্কোর শেয়ার করা (সাধারণ ওয়েব - Web Share API)
// ------------------------------------------------------------
// মোবাইল ব্রাউজারে এটা ক্লিক করলে ফোনের নিজস্ব "শেয়ার" মেনু খুলবে
// (WhatsApp, Facebook, Messenger যা কিছু ইনস্টল করা আছে - সব
// অপশন দেখাবে)। যেসব ব্রাউজার/ডিভাইস Web Share সাপোর্ট করে না
// (বেশিরভাগ ডেস্কটপ ব্রাউজার), সেখানে স্কোর-টেক্সট ক্লিপবোর্ডে
// কপি হয়ে যাবে, যাতে ইউজার নিজে পেস্ট করে শেয়ার করতে পারে।
// ============================================================
function shareScore() {
  const shareText = `আমি "যুক্তবর্ণ ভাঙো" গেমে ${GAME_DURATION} সেকেন্ডে ${winCount} টি সঠিক উত্তর দিয়েছি! তুমি পারবে আমাকে হারাতে?`;
  const shareUrl = window.location.href;

  let imageData;
  try {
    imageData = generateScoreCardImage();
  } catch (e) {
    console.error("স্কোর-কার্ড ইমেজ তৈরি করতে সমস্যা হয়েছে:", e);
  }

  // ব্রাউজার Web Share API + ছবি শেয়ার সাপোর্ট করলে (বেশিরভাগ মোবাইল ব্রাউজার)
  if (navigator.share && imageData) {
    fetch(imageData)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], "score.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ text: shareText, url: shareUrl, files: [file] });
        }
        return navigator.share({ text: shareText, url: shareUrl });
      })
      .catch((err) => {
        // ইউজার নিজে শেয়ার বাতিল করলেও এই এরর আসে, তাই চুপচাপ রেখে দেওয়া হচ্ছে
        console.warn("শেয়ার সম্পন্ন হয়নি:", err);
      });
  } else if (navigator.share) {
    // ছবি ছাড়া, শুধু টেক্সট শেয়ার
    navigator.share({ text: shareText, url: shareUrl }).catch(() => {});
  } else {
    // Web Share API সাপোর্ট নেই (বেশিরভাগ ডেস্কটপ ব্রাউজার) - ক্লিপবোর্ডে কপি
    navigator.clipboard
      .writeText(`${shareText} ${shareUrl}`)
      .then(() => alert("স্কোরের লেখা কপি হয়েছে! এখন যেকোনো জায়গায় পেস্ট করে শেয়ার করতে পারেন।"))
      .catch(() => alert(shareText));
  }
}

// ============================================================
// ইভেন্ট লিসেনার
// ============================================================
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);
document.getElementById("shareBtn").addEventListener("click", shareScore);
document.getElementById("submitBtn").addEventListener("click", submitAnswer);
document.getElementById("answerInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer();
});

// ============================================================
// গেম চালু করা
// ============================================================
loadData();