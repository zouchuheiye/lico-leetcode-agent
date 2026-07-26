// 木偶蜜蜂 lico：SVG 形象、嗡嗡声(Web Audio)、声情并茂朗读(Web Speech)
const Bee = (function () {
  const el = document.getElementById("beeSvg");
  const speechEl = document.getElementById("speech");
  const handEl = document.getElementById("handHint");

  // ---------------- SVG 形象（含提线、发条钥匙、扇动的翅膀）----------------
  el.innerHTML = `
    <!-- 木偶提线 -->
    <line class="string" x1="70"  y1="0" x2="86"  y2="70"/>
    <line class="string" x1="150" y1="0" x2="134" y2="70"/>
    <line class="string" x1="110" y1="0" x2="110" y2="52"/>

    <!-- 翅膀 -->
    <g class="wing" style="transform-origin:96px 96px">
      <ellipse cx="78" cy="88" rx="26" ry="16" fill="#cfeaff" stroke="#9cc9ea" stroke-width="2" opacity="0.85"/>
    </g>
    <g class="wing" style="transform-origin:124px 96px; animation-delay:.06s">
      <ellipse cx="142" cy="88" rx="26" ry="16" fill="#cfeaff" stroke="#9cc9ea" stroke-width="2" opacity="0.85"/>
    </g>

    <!-- 发条钥匙：插在小蜜蜂后背上，轴插入身体，手柄露在背后上方转动 -->
    <!-- 静态轴：从后背插入身体（身体/头会盖住下半截，呈“插进背里”的效果） -->
    <rect x="106" y="22" width="8" height="96" rx="3" fill="#9c6f1f"/>
    <!-- 可转动手柄（圆环+横杆），绕轴中心旋转 -->
    <g id="windKey">
      <circle cx="110" cy="22" r="13" fill="none" stroke="#b98a2e" stroke-width="6"/>
      <rect x="86" y="18" width="48" height="8" rx="4" fill="#b98a2e"/>
      <circle cx="110" cy="22" r="5" fill="#b98a2e"/>
    </g>

    <!-- 身体（黄黑条纹，木偶关节感） -->
    <ellipse cx="110" cy="118" rx="46" ry="40" fill="#f8c445" stroke="#7a5a12" stroke-width="3"/>
    <path d="M78 104 q32 12 64 0" stroke="#4a3b1f" stroke-width="9" fill="none"/>
    <path d="M74 124 q36 14 72 0" stroke="#4a3b1f" stroke-width="9" fill="none"/>
    <path d="M80 144 q30 10 60 0" stroke="#4a3b1f" stroke-width="8" fill="none"/>
    <!-- 关节铆钉，强调木偶感 -->
    <circle cx="64" cy="118" r="4" fill="#7a5a12"/>
    <circle cx="156" cy="118" r="4" fill="#7a5a12"/>

    <!-- 头 -->
    <circle cx="110" cy="70" r="22" fill="#f8c445" stroke="#7a5a12" stroke-width="3"/>
    <!-- 触角 -->
    <path d="M100 52 q-8 -14 -16 -16" stroke="#4a3b1f" stroke-width="3" fill="none"/>
    <path d="M120 52 q8 -14 16 -16" stroke="#4a3b1f" stroke-width="3" fill="none"/>
    <circle cx="83" cy="35" r="3.5" fill="#4a3b1f"/>
    <circle cx="137" cy="35" r="3.5" fill="#4a3b1f"/>
    <!-- 眼睛 -->
    <circle cx="102" cy="68" r="5" fill="#3a2c12"/>
    <circle cx="118" cy="68" r="5" fill="#3a2c12"/>
    <circle cx="103.5" cy="66.5" r="1.6" fill="#fff"/>
    <circle cx="119.5" cy="66.5" r="1.6" fill="#fff"/>
    <!-- 微笑 -->
    <path d="M100 80 q10 8 20 0" stroke="#7a5a12" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <!-- 腮红 -->
    <circle cx="92" cy="76" r="4" fill="#f6a3a0" opacity="0.7"/>
    <circle cx="128" cy="76" r="4" fill="#f6a3a0" opacity="0.7"/>
  `;

  // ---------------- 声情并茂朗读 ----------------
  let voices = [];
  function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function pickVoice() {
    if (!voices.length) return null;
    return voices.find(v => /zh|Chinese|Yaoyao|Huihui|Tingting/i.test(v.lang + v.name))
        || voices[0]; // 退而求其次：用任意已装语音，至少能出声
  }
  function hint(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(hint._t); hint._t = setTimeout(() => t.classList.add("hidden"), 3600);
  }
  function speak(text, opts = {}) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { hint("当前浏览器不支持语音朗读"); resolve(); return; }
      if (!voices.length) loadVoices();           // 关键：点击时重新读取（加载时已可能为空）
      speechSynthesis.cancel();
      speechSynthesis.resume();                    // 规避部分浏览器暂停后不发音
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "zh-CN"; }
      u.pitch = opts.pitch != null ? opts.pitch : 1.4; // 高音更像小蜜蜂
      u.rate = opts.rate != null ? opts.rate : 1.0;
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      u.onend = finish; u.onerror = finish;
      speechSynthesis.speak(u);
      // 兜底：部分浏览器 onend 不触发，防止流程卡住
      setTimeout(finish, Math.min(60000, text.length * 260 + 4000));
      if (!voices.length) hint("没装语音包，听题可能无声——在系统设置里装一个中文语音即可");
    });
  }
  function stopSpeak() { if (window.speechSynthesis) speechSynthesis.cancel(); }

  // ---------------- 动作 & 台词 ----------------
  function show() { el.classList.remove("hidden"); }
  function flyIn() {
    show();
    el.classList.add("fly-in");
    setTimeout(() => { el.classList.remove("fly-in"); el.classList.add("hover"); }, 1800);
  }
  function setWinding(on) {
    el.classList.toggle("winding", on); // 仅控制发条转动的视觉
  }
  function jam() {
    el.classList.add("jammed", "stuck");
    setTimeout(() => el.classList.remove("stuck", "jammed"), 1600);
  }
  function happy() { el.classList.add("happy"); setTimeout(() => el.classList.remove("happy"), 1200); }
  function stopAll() { setWinding(false); }

  // 说话：纯朗读，不再显示气泡（页面本身已展示对应文字，避免重复）
  async function say(text, { voice = true, keep = false, pitch } = {}) {
    speechEl.textContent = text;
    if (voice) await speak(text, { pitch });
  }
  function hideSpeech() { speechEl.classList.add("hidden"); }

  // 手势提示指向某元素
  function pointAt(target) {
    if (!target) { handEl.classList.add("hidden"); return; }
    const r = target.getBoundingClientRect();
    handEl.style.left = (r.left + r.width / 2 - 20) + "px";
    handEl.style.top = (r.top - 46) + "px";
    handEl.classList.remove("hidden");
  }
  function hideHand() { handEl.classList.add("hidden"); }

  return {
    flyIn, setWinding, jam, happy, stopAll, say, hideSpeech,
    speak, stopSpeak, pointAt, hideHand,
  };
})();
