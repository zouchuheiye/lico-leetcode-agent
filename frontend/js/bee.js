// 木偶蜜蜂 lico：SVG 形象、嗡嗡声(Web Audio)、声情并茂朗读(Web Speech)
const Bee = (function () {
  const el = document.getElementById("beeSvg");
  const speechEl = document.getElementById("speech");

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
    <path id="beeMouth" d="M100 80 q10 8 20 0" stroke="#7a5a12" stroke-width="2.5" fill="none" stroke-linecap="round"/>
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

  // ---------------- 就地逐字高亮朗读（吸引注意力的"听"） ----------------
  // 把目标容器里的文字拆成 <span>，随着语音推进逐字加粗变黑体，读完恢复。
  let hlState = null; // { container }
  function talk(on) { el.classList.toggle("talking", !!on); }
  function clearHighlight() {
    if (!hlState) return;
    const c = hlState.container;
    if (c && c.dataset.hlBackup != null) {
      c.innerHTML = c.dataset.hlBackup;
      delete c.dataset.hlBackup;
    }
    hlState = null;
  }
  function stopHL() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    clearHighlight();
    hideSpeech();
  }
  function speakHL(text, containerEl, opts = {}) {
    return new Promise((resolve) => {
      // 若有别的正在高亮的容器，先恢复它，避免残留
      if (hlState) clearHighlight();
      if (!window.speechSynthesis) { hint("当前浏览器不支持语音朗读"); resolve(); return; }
      if (!containerEl) {
        // 退化：没有高亮容器时直接朗读
        if (!voices.length) loadVoices();
        speechSynthesis.cancel(); speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "zh-CN";
        u.pitch = opts.pitch != null ? opts.pitch : 1.4;
        u.rate = opts.rate != null ? opts.rate : 1.0;
        u.onend = () => resolve(); u.onerror = () => resolve();
        speechSynthesis.speak(u);
        return;
      }
      if (!voices.length) loadVoices();
      const backup = (containerEl.dataset.hlBackup != null)
        ? containerEl.dataset.hlBackup : containerEl.innerHTML;
      containerEl.dataset.hlBackup = backup;
      // 结构化高亮：遍历容器内文本节点逐字包 span，保留 <p>/<br> 等标签结构。
      // 修复"听讲解会把分段弄丢"：不再整体清空容器重排成一条无分段字符流。
      function buildHighlight(root) {
        const spans = [];
        const pauseAfter = []; // 与 spans 对齐，单位 ms（行/段边界停顿）
        const BLOCK = /^(p|div|li|h[1-6]|pre|blockquote|section|article)$/;
        (function walk(node) {
          if (node.nodeType === 3) {                 // 文本节点
            const txt = node.nodeValue;
            if (!txt) return;
            const frag = document.createDocumentFragment();
            for (const ch of txt) {
              let c = ch;
              if ("#*=>•👉`".includes(ch)) c = " ";  // 符号→空格（长度不变）
              if (ch === "[" || ch === "]") continue; // 方括号删除（不生成 span、不朗读）
              const s = document.createElement("span");
              s.className = "tts-ch";
              s.textContent = c;
              frag.appendChild(s);
              spans.push(s);
              pauseAfter.push(0);
            }
            node.parentNode.replaceChild(frag, node);
            return;
          }
          if (node.nodeType === 1) {                 // 元素节点
            const tag = node.tagName.toLowerCase();
            if (tag === "br") {                      // 换行 → 末尾补停顿
              if (spans.length) pauseAfter[spans.length - 1] += 240;
              return;
            }
            const had = spans.length;
            Array.from(node.childNodes).forEach(walk);
            if (BLOCK.test(tag) && spans.length > had) pauseAfter[spans.length - 1] += 240; // 段后停顿
            return;
          }
        })(root);
        const speakText = spans.map((s) => s.textContent).join("");
        return { spans, pauseAfter, speakText };
      }
      const built = buildHighlight(containerEl);
      const spans = built.spans;
      const pauseAfter = built.pauseAfter;
      const speakText = built.speakText;
      const chars = Array.from(speakText);
      const total = chars.length;

      // ---- 时间轴 + 标点停顿建模（修复"高亮比语音快"的核心）----
      // 每个普通字占 charDur 毫秒；每个标点在其后插入停顿，使高亮在标点处也"停一下"，
      // 贴近真实朗读节奏。初始字速刻意保守（≈3.3 字/秒），宁可慢不可快。
      const PAUSE = { ",":200, "，":200, "、":200, ":":240, "：":240, ";":300, "；":300,
                      "\n":240, ".":440, "。":440, "!":440, "！":440, "?":440, "？":440,
                      "…":440, "（":120, "(":120, "）":120, ")":120 };
      let charDur = opts.charDur || 300;
      const starts = new Array(total);
      let acc = 0;
      for (let i = 0; i < total; i++) {
        starts[i] = acc;
        acc += charDur;
        const p = PAUSE[chars[i]];
        if (p) acc += p;            // 该字符念完后、下一字前的停顿
        if (pauseAfter[i]) acc += pauseAfter[i]; // 行/段边界停顿
      }
      const totalDur = acc;

      let rafId = null, t0 = 0, started = false, done = false, current = -1;
      const utf16ToCp = (idx) => Array.from(speakText.slice(0, idx)).length;

      function paint(target) {
        while (current < target && current + 1 < total) {
          current++;
          if (current > 0) {
            spans[current - 1].classList.remove("tts-current");
            spans[current - 1].classList.add("tts-read");
          }
          spans[current].classList.add("tts-current");
        }
      }
      function tick(now) {
        if (done) return;
        if (!started) { rafId = requestAnimationFrame(tick); return; }
        const elapsed = now - t0;
        let target = current;
        while (target + 1 < total && starts[target + 1] <= elapsed) target++;
        paint(target);
        rafId = requestAnimationFrame(tick);
      }
      // 方案α：onboundary 只"纠偏时间轴"，绝不直接 paint——
      // 高亮永远由 rAF 顺序推进，且时间轴刻意滞后语音 LAG 毫秒。
      // 保证"亮不会比读快"；代价是偶尔比读慢 100~200ms（用户已接受）。
      const LAG = 140;                                   // 刻意滞后语音的量（ms）
      function calibrate(bi, nowMs) {
        const elapsed = nowMs - t0;
        const measured = elapsed / (bi + 1);             // 实测平均每字耗时（含停顿摊薄）
        if (measured > 80 && measured < 1500) {
          charDur = Math.round(charDur * 0.6 + measured * 0.42);  // 低通防抖，系数略偏慢
        }
        const from = current + 1;                        // 只重排还没亮的字，绝不回涂/跳涂
        if (from >= total) return;
        if (bi >= from) {
          // 高亮落后于语音：把落后的字排进未来 LAG 窗口内，由 rAF 平滑逐个点亮追上
          const stepMs = Math.max(16, Math.min(charDur, LAG / (bi - from + 1)));
          let c = elapsed;
          for (let i = from; i <= bi; i++) { starts[i] = c; c += stepMs; }
        }
        // bi 之后：以语音真值为锚，按最新字速 + LAG 滞后重排
        // （若高亮已超前 bi，starts[current+1] 会被排到未来 → rAF 自然冻结等语音追上）
        let a = elapsed + LAG;
        for (let i = bi + 1; i < total; i++) {
          a += charDur;
          const p = PAUSE[chars[i - 1]];
          if (p) a += p;
          if (i >= from) starts[i] = a;
        }
      }
      function finish() {
        if (done) return; done = true;
        if (rafId) cancelAnimationFrame(rafId);
        spans.forEach((s) => { s.classList.remove("tts-current"); s.classList.add("tts-read"); });
        // 让"已全部读完"的粗体尾巴短暂停留，再恢复原文结构
        setTimeout(() => { if (hlState && hlState.container === containerEl) clearHighlight(); }, 380);
        talk(false);
        resolve();
      }

      const u = new SpeechSynthesisUtterance(speakText);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "zh-CN";
      u.pitch = opts.pitch != null ? opts.pitch : 1.4;
      u.rate = opts.rate != null ? opts.rate : 1.0;
      u.onstart = () => { if (started) return; t0 = performance.now(); started = true; };
      u.onboundary = (e) => {
        if (e && typeof e.charIndex === "number") {
          const bi = Math.min(total - 1, utf16ToCp(e.charIndex));
          calibrate(bi, performance.now());
        }
      };
      u.onend = finish; u.onerror = finish;
      hlState = { container: containerEl };
      talk(true);
      speechSynthesis.cancel(); speechSynthesis.resume();
      speechSynthesis.speak(u);
      rafId = requestAnimationFrame(tick);
      // 兜底：若 onstart 迟迟不触发（部分浏览器），强制起算，避免高亮卡住
      setTimeout(() => { if (!started) { t0 = performance.now(); started = true; } }, 600);
      // 兜底：防止极端情况下 onend 不触发导致高亮卡住
      setTimeout(finish, Math.min(120000, totalDur + 8000));
    });
  }

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

  // 说话：显示气泡 + 朗读
  async function say(text, { voice = true, keep = false, pitch } = {}) {
    speechEl.textContent = text;
    speechEl.classList.remove("hidden");
    if (voice) await speak(text, { pitch });
    if (!keep) setTimeout(() => speechEl.classList.add("hidden"), 400);
  }
  function hideSpeech() { speechEl.classList.add("hidden"); }

  return {
    flyIn, setWinding, jam, happy, stopAll, say, hideSpeech,
    speak, stopSpeak, speakHL, stopHL, talk,
  };
})();
