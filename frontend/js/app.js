// 主流程编排：配置 -> 上发条 -> 开始盒子 -> 手撕学习 -> 已做题集 / 通关
(function () {
  const $ = (id) => document.getElementById(id);
  const screens = ["screenConfig", "screenStartBox", "screenLearn", "screenArchive", "screenFinish"];
  function showScreen(id) {
    screens.forEach((s) => $(s).classList.toggle("hidden", s !== id));
    // 进入「已做题集」页时，把右上角按钮变成「去做新题」，点击可返回学习页
    const ab = $("btnArchive");
    if (id === "screenArchive") {
      ab.textContent = "🐝 去做新题";
      ab.dataset.mode = "return";
      ab.title = "返回学习页，开始做新题";
    } else {
      ab.textContent = "📚 已做题集";
      ab.dataset.mode = "archive";
      ab.title = "查看已做过的题目";
    }
  }
  function toast(msg, ms = 2200) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), ms);
  }

  let state = { problem: null, stepIndex: 0, total: 100, doneCount: 0, drafts: {} };

  // 切换学习页布局：mode="problem" 时左列（题目）居中、右列隐藏；mode="learn" 时恢复两列
  function setLayoutMode(mode) {
    const grid = document.querySelector(".learn-grid");
    if (!grid) return;
    grid.classList.toggle("problem-only", mode === "problem");
  }

  // 启动时绑定语言选择器（讲解页内嵌；与学习轨迹完全解耦，仅写入 localStorage）
  function bindLangPicker() {
    const sel = $("langSelect");
    if (!sel) return;
    const saved = (() => { try { return localStorage.getItem("lico-lang"); } catch { return null; } })();
    if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
    sel.addEventListener("change", () => {
      try { localStorage.setItem("lico-lang", sel.value); } catch {}
      const txt = sel.options[sel.selectedIndex].text;
      toast(`已切换为「${txt}」· 下次出题/分步/审查都会用此语言`);
    });
  }

  // ---------------------------------------------------------- 初始化
  async function init() {
    bindLangPicker();  // 先绑定语言选择器
    const st = await API.status();
    state.total = st.total; state.doneCount = st.done_count;
    $("modelBadge").textContent = st.model_label;
    updateProgress();
    Bee.flyIn();
    if (st.configured) {
      // 已配置：直接进入开始盒子（续学进行中的题目）
      await sleep(1600);
      Bee.setWinding(true);
      enterStartBox(st.resume_seq);
    } else {
      showScreen("screenConfig");
      await sleep(1700);
      await Bee.say("我叫 lico，是一只木偶蜜蜂，也是你的力扣算法学习辅导员，先给我上发条吧～", { keep: true });
      $("apiKey").focus();
    }
  }

  function updateProgress() {
    $("progressText").textContent = `${state.doneCount} / ${state.total}`;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 三按钮朗读行：🔊 听 / 🗣️ 朗读 / 🚀 听完读完下一步（讲解页用：进入分步敲代码）
  const AUDIO_ROW = (listenLabel) => `
    <div class="audio-row" data-audio>
      <button class="btn small" data-act="listen">🔊 ${listenLabel}</button>
      <button class="btn small ghost" data-act="read">🗣️ 朗读</button>
      <button class="btn small skip" data-act="skip">🚀 听完，读完，进入分步敲代码 →</button>
    </div>`;

  // 讲解页底部：语言选择行（默认 Python，与学习轨迹完全解耦，仅 localStorage 记忆）
  const LANG_PICKER = `
    <div class="lang-row">
      <label for="langSelect">🧪 选用语言：</label>
      <select id="langSelect" class="lang-select">
        <option value="python">Python</option>
        <option value="cpp">C++</option>
        <option value="java">Java</option>
        <option value="go">Go</option>
        <option value="javascript">JavaScript</option>
      </select>
      <span class="muted" style="font-size:12px">（选中后自动记忆，下次默认此语言）</span>
    </div>`;

  // 绑定一组朗读行按钮
  function bindAudioRow(parent, { onListen, onReadDone, onSkip }) {
    // 兼容两种结构：父元素自身就是音频行，或音频行是父元素的后代
    const rowEl = (parent.matches && parent.matches("[data-audio]")) ? parent : parent.querySelector("[data-audio]");
    if (!rowEl) return;

    // 听题按钮：空闲显示原标签（如"🔊 开始听题"），朗读中变成"🔇 不想听了"，再点停止朗读
    const listenBtn = rowEl.querySelector('[data-act="listen"]');
    const originalLabel = listenBtn.textContent;
    const STOPPED_LABEL = "🔇 不想听了";
    listenBtn.textContent = originalLabel;
    listenBtn.dataset.listening = "";
    listenBtn.onclick = async () => {
      if (listenBtn.dataset.listening === "1") {
        // 已经在朗读 → 点击停止（清高亮 + 停语音）
        Bee.stopHL();
        listenBtn.textContent = originalLabel;
        listenBtn.dataset.listening = "";
        return;
      }
      listenBtn.textContent = STOPPED_LABEL;
      listenBtn.dataset.listening = "1";
      try {
        await onListen();
      } finally {
        // 朗读结束（自然结束 / 被打断 / 抛错）后恢复按钮
        listenBtn.textContent = originalLabel;
        listenBtn.dataset.listening = "";
      }
    };

    const readBtn = rowEl.querySelector('[data-act="read"]');
    // 每次绑定都重置"朗读结束"状态，避免上一题残留导致直接跳过
    readBtn.dataset.done = "";
    readBtn.textContent = "🗣️ 朗读";
    readBtn.classList.remove("read-done");
    readBtn.onclick = () => {
      if (readBtn.dataset.done === "1") { onReadDone(); return; }
      readBtn.dataset.done = "1";
      readBtn.textContent = "✅ 我朗读结束了";
      readBtn.classList.add("read-done");
      toast("慢慢读，不着急～读完了就点「我朗读结束了」");
    };
    const skipBtn = rowEl.querySelector('[data-act="skip"]');
    if (skipBtn) skipBtn.onclick = () => onSkip();
  }

  // 记录断点：当前进行到的阶段与步骤（下次从中断处继续）
  function recordProgress(phase, stepIndex = -1) {
    if (state.problem) API.progress(state.problem.id, phase, stepIndex);
  }

  // ---------------------------------------------------------- 上发条 / 连接测试
  $("btnWindUp").addEventListener("click", async () => {
    const key = $("apiKey").value.trim();
    const msg = $("configMsg");
    if (!key) { msg.className = "config-msg err"; msg.textContent = "请先输入 Key 呀～"; return; }
    $("btnWindUp").disabled = true;
    msg.className = "config-msg"; msg.innerHTML = '<span class="spinner"></span> 正在拧动发条，测试连接…';
    Bee.hideSpeech();
    try {
      const res = await API.testKey(key);
      if (res.ok) {
        msg.className = "config-msg ok"; msg.textContent = "✅ 发条转起来啦！连接成功。";
        Bee.setWinding(true); Bee.happy();
        await Bee.say("咔哒——发条转起来啦！嗡嗡嗡~ 我们开始吧！");
        enterStartBox(false);
      } else {
        msg.className = "config-msg err"; msg.textContent = "❌ " + (res.error || "连接失败，发条卡住了。");
        Bee.jam();
        await Bee.say("咦？发条卡住了，动不了…检查一下这把钥匙对不对？");
        $("btnWindUp").disabled = false;
      }
    } catch (e) {
      msg.className = "config-msg err"; msg.textContent = "❌ 请求异常，发条卡住了。";
      Bee.jam(); $("btnWindUp").disabled = false;
    }
  });

  // ---------------------------------------------------------- 开始盒子
  async function enterStartBox(resumeSeq) {
    showScreen("screenStartBox");
    await sleep(300);
    const box = $("startBox");
    const titleEl = box.querySelector(".start-box-title");
    const subEl = box.querySelector(".start-box-sub");
    if (resumeSeq) {
      titleEl.textContent = `我们继续第 ${resumeSeq} 题吧`;
      subEl.textContent = "点击这个方框，接着上次中断的地方继续学习…";
      await Bee.say(`欢迎回来！我们接着第 ${resumeSeq} 题继续学习吧～`, { keep: true });
    } else {
      titleEl.textContent = "我们开始学习第一题吧";
      subEl.textContent = "点击这个方框，出题小蜜蜂开始运转…";
      await Bee.say("太好了，我们开始学习第一题吧！", { keep: true });
    }
    Bee.pointAt(box);
  }
  $("startBox").addEventListener("click", async () => {
    const box = $("startBox");
    if (box.classList.contains("working")) return;
    Bee.hideHand(); Bee.hideSpeech();
    box.classList.add("working");
    box.querySelector(".start-box-sub").innerHTML = '<span class="spinner"></span> 出题小蜜蜂正在运转…';
    try {
      const res = await API.start(null);
      if (res.finished) { showFinish(); return; }
      loadProblem(res.problem, res.resume ? res.checkpoint : null);
    } catch (e) {
      toast("出题失败，请稍后再试");
    } finally {
      box.classList.remove("working");
      const sub = box.querySelector(".start-box-sub");
      sub.textContent = sub.textContent.includes("继续")
        ? "点击这个方框，接着上次中断的地方继续学习…"
        : "点击这个方框，出题小蜜蜂开始运转…";
    }
  });

  // ---------------------------------------------------------- 加载题目
  async function loadProblem(problem, checkpoint) {
    state.problem = problem; state.stepIndex = 0;
    showScreen("screenLearn");
    setLayoutMode("problem");  // 题目页：左列居中、右列隐藏
    Bee.hideHand();
    renderProblemCard(problem);
    // 复习（已有讲解与步骤）或续学：workCard 先给个占位
    $("workCard").innerHTML = `<div class="work-placeholder">先听题、朗读题目，熟悉之后我来讲解～</div>`;
    if (checkpoint && checkpoint.phase && checkpoint.phase !== "problem") {
      // 断点续学：直接跳到上次中断的阶段（不再语音欢迎，安静续学）
      restoreCheckpoint(checkpoint);
    } else {
      Bee.say(`这是第 ${problem.seq} 题《${problem.title}》，先熟悉一下题目吧。`);
      recordProgress("problem", -1);
    }
  }

  // 依据保存的断点恢复到对应阶段
  function restoreCheckpoint(cp) {
    const p = state.problem;
    switch (cp.phase) {
      case "explain":
        p.explanation = p.explanation || null;
        if (p.explanation) { renderExplain(p.explanation); }
        else { goExplain(); }
        break;
      case "steps":
      case "step_typing": {
        (async () => {
          if (!p.steps || !p.steps.length) {
            try { const d = await API.steps(p.id); p.steps = d.steps || []; } catch (e) { p.steps = []; }
          }
          if (!p.steps.length) { goSteps(); return; }
          state.stepIndex = Math.max(0, Math.min(cp.step_index, p.steps.length - 1));
          if (cp.phase === "step_typing") renderStepTyping();
          else renderStepExplain();
        })();
        break;
      }
      case "final":
        goFinal();
        break;
      default:
        Bee.say(`这是第 ${p.seq} 题《${p.title}》，先熟悉一下题目吧。`);
    }
  }

  function renderProblemCard(p) {
    $("pSeq").textContent = "#" + p.seq;
    $("pTitle").textContent = p.title;
    $("pDiff").textContent = p.difficulty || "";
    $("pStatement").textContent = p.content.statement || "";
    const ex = (p.content.examples || []).map((e, i) => `
      <div class="example"><b>示例 ${i + 1}</b><br/>
      <code>输入：${escapeHtml(e.input || "")}</code><br/>
      <code>输出：${escapeHtml(e.output || "")}</code>
      ${e.explanation ? `<br/><span class="muted">${escapeHtml(e.explanation)}</span>` : ""}</div>`).join("");
    $("pExamples").innerHTML = ex;
    const cons = (p.content.constraints || []).map((c) => `<li>${escapeHtml(c)}</li>`).join("");
    $("pConstraints").innerHTML = cons ? `<b>约束：</b><ul>${cons}</ul>` : "";
    // 示例与约束折叠器：默认收起，点击展开（每次新题都重置为收起）
    const revealBox = $("pReveal"), revealBtn = $("pRevealBtn");
    revealBtn.onclick = () => {
      const collapsed = revealBox.classList.toggle("collapsed");
      revealBtn.setAttribute("aria-expanded", String(!collapsed));
      revealBtn.textContent = collapsed ? "📚 查看示例与约束 ▾" : "📚 收起示例与约束 ▴";
    };
    revealBox.classList.add("collapsed");
    revealBtn.setAttribute("aria-expanded", "false");
    revealBtn.textContent = "📚 查看示例与约束 ▾";
    // 绑定「听题 / 朗读题目 / 听完读完」
    const pAudio = $("problemAudio");
    bindAudioRow(pAudio, {
      onListen: async () => {
        const p = state.problem;
        API.event(p.id, -1, "listen_problem");
        await Bee.speakHL(p.content.statement, $("pStatement"), {});
      },
      onReadDone: async () => {
        const p = state.problem;
        API.event(p.id, -1, "read_problem");
        await Bee.say("很好，你已经熟悉了题目，我开始讲解了！");
        goExplain();
      },
      onSkip: async () => {
        const p = state.problem;
        Bee.stopHL();
        API.event(p.id, -1, "skip_problem");
        toast("跳过朗读，直接开讲～");
        goExplain();
      },
    });
  }

  // ---------------------------------------------------------- 讲解阶段
  async function goExplain() {
    const p = state.problem;
    setLayoutMode("learn");  // 进入讲解：恢复两列布局
    $("workCard").innerHTML = `<div class="work-placeholder"><span class="spinner"></span> 讲解小蜜蜂正在准备…</div>`;
    let data;
    try { data = await API.explain(p.id); } catch (e) { toast("讲解生成失败"); return; }
    p.explanation = data.explanation;
    recordProgress("explain", -1);
    renderExplain(p.explanation);
  }

  function renderExplain(ex) {
    // 兼容：旧版 explanation 是字符串；5字段版是对象（历史缓存）
    const explanation = (ex && typeof ex === "object") ? (ex.explanation || "") : (ex || "");
    $("workCard").innerHTML = `
      <div class="section-title">💡 讲解</div>
      <div class="explain-text" id="explainBody">${escapeHtml(explanation)}</div>
      ${AUDIO_ROW("开始听例子")}
      ${LANG_PICKER}`;
    // 重新绑定语言选择器（DOM 重建后）
    bindLangPicker();
    bindAudioRow($("workCard"), {
      onListen: async () => {
        API.event(state.problem.id, -1, "listen_example");
        // 听讲解正文（去掉残留标记，避免朗读到 # * 这种符号）
        const txt = String(explanation).replace(/[#*=>•👉`]/g, " ").replace(/==|\[\[|\]\]/g, "");
        await Bee.speakHL(txt, $("explainBody"), {});
      },
      onReadDone: async () => {
        API.event(state.problem.id, -1, "read_example");
        await Bee.say("很好！接下来我把代码一步一步拆给你，我们开始手撕吧！");
        goSteps();
      },
      onSkip: async () => {
        Bee.stopHL();
        API.event(state.problem.id, -1, "skip_example");
        toast("跳过朗读例子，直接拆解～");
        goSteps();
      },
    });
  }

  // ---------------------------------------------------------- 分步手撕
  async function goSteps() {
    const p = state.problem;
    $("workCard").innerHTML = `<div class="work-placeholder"><span class="spinner"></span> 分解小蜜蜂正在拆解代码…</div>`;
    let data;
    try {
      data = await API.steps(p.id);
      if (!data || !Array.isArray(data.steps) || data.steps.length === 0) {
        throw new Error("steps 为空（后端可能生成失败）");
      }
      p.steps = data.steps;
      state.stepIndex = 0;
      renderStepExplain();
    } catch (e) {
      console.error("[goSteps] 失败:", e);
      toast("步骤生成失败：" + (e && e.message ? e.message : "未知错误"));
      $("workCard").innerHTML = `<div class="work-placeholder">⚠️ 步骤生成失败<br><span class="muted">${escapeHtml(String(e && e.message || e || ""))}</span><br><button class="btn small" data-act="retry-steps">🔁 重试</button></div>`;
      const retry = $("workCard").querySelector('[data-act="retry-steps"]');
      if (retry) retry.onclick = () => goSteps();
    }
  }

  function stepDots(active) {
    const n = state.problem.steps.length;
    let s = '<div class="step-nav">';
    for (let i = 0; i < n; i++) {
      const cls = i < active ? "done" : i === active ? "active" : "";
      // 用 button + data-step-index，配合下方事件委托，点击可跳到任意步骤
      s += `<button type="button" class="step-dot ${cls}" data-step-index="${i}" title="跳到第 ${i + 1} 步">${i + 1}</button>`;
    }
    s += `<span class="muted" style="margin-left:8px">共 ${n} 步</span></div>`;
    return s;
  }

  // 步骤指示器点击跳转（事件委托，全局只绑一次）
  document.addEventListener("click", (e) => {
    const dot = e.target.closest(".step-dot[data-step-index]");
    if (!dot) return;
    if (!state.problem || !state.problem.steps || !state.problem.steps.length) return;
    const i = parseInt(dot.dataset.stepIndex, 10);
    if (Number.isNaN(i)) return;
    if (i < 0 || i >= state.problem.steps.length) return;
    if (i === state.stepIndex) return; // 当前步骤不重复渲染
    state.stepIndex = i;
    renderStepExplain();
  });

  // 讲解页：左列（原题目区）改为分步讲解内容，保留听/读按钮
  function renderLeftExplain(step, onReadDone) {
    const p = state.problem, i = state.stepIndex;
    const left = $("problemCard") || document.querySelector(".problem-card");
    if (!left) return; // 防御：左列不存在时不抛错
    // 前面步骤折叠成方块 [第 1 步] [第 2 步] ...，平时只显示标签，点击才展开。
    // 当前步（第 i+1 步）平铺完整代码，方便用户看着抄。
    let folds = "";
    for (let k = 0; k < i; k++) {
      const s = p.steps[k];
      const title = s.title || `第 ${k + 1} 步`;
      const code = s.code || "";
      folds += `
        <div class="step-fold">
          <button type="button" class="step-fold-head">
            <span class="step-fold-caret">▾</span>
            <span class="step-fold-title">📦 第 ${k + 1} 步：${escapeHtml(title)}</span>
          </button>
          <pre class="code code-fold-body" hidden>${escapeHtml(code)}</pre>
        </div>`;
    }
    const incCode = step.incremental_code || step.code || "";
    const separator = i > 0
      ? `<div class="step-separator"><span>— 第 ${i + 1} 步新增 —</span></div>`
      : "";
    left.innerHTML = `
      ${stepDots(i)}
      <div class="section-title">🧩 ${escapeHtml(step.title)}</div>
      <div class="explain-text" id="stepExplain">${escapeHtml(step.explanation || "")}</div>
      ${folds}
      ${separator}
      <pre class="code code-inc">${escapeHtml(incCode)}</pre>
      <div class="audio-row" data-audio>
        <button class="btn small" data-act="listen">🔊 听第${i + 1}步</button>
        <button class="btn small ghost" data-act="read">🗣️ 朗读</button>
      </div>`;
    // 折叠方块：点击标题展开/收起（同时切 .open class + pre 的 hidden 属性，双保险）
    left.querySelectorAll(".step-fold-head").forEach((hd) => {
      hd.addEventListener("click", () => {
        const fold = hd.closest(".step-fold");
        if (!fold) return;
        const opened = fold.classList.toggle("open");
        const body = fold.querySelector(".code-fold-body");
        if (body) body.hidden = !opened;
      });
    });
    bindAudioRow(left, {
      onListen: async () => {
        API.event(p.id, i, "listen_step");
        await Bee.speakHL(step.explanation, $("stepExplain"), {});
      },
      onReadDone: async () => {
        API.event(p.id, i, "read_step");
        if (onReadDone) await onReadDone();
        else toast("朗读完这一步～");
      },
      onSkip: () => {},
    });
  }

  // 默写页：左列改为讲解上下文（之前累积代码 + 当前步骤提示）
  function renderLeftTyping(p, i) {
    const step = p.steps[i];
    const prevAll = p.steps.slice(0, i).map((s) => s.code || "").filter(Boolean).join("\n\n");
    const left = $("problemCard") || document.querySelector(".problem-card");
    if (!left) return; // 防御：左列不存在时不抛错，避免 renderStepTyping 中断
    left.innerHTML = `
      ${stepDots(i)}
      <div class="section-title">📝 第 ${i + 1} 步 · ${escapeHtml(step.title)}</div>
      <div class="dictation-hint">${i > 0 ? "上方是前面步骤已写好的代码，下方是第 " + (i + 1) + " 步要新增的内容。" : "这是第一步，从头写出完整代码。"}</div>
      ${prevAll ? `<pre class="code readonly">${escapeHtml(prevAll)}</pre>` : ""}
      <pre class="code">${escapeHtml(step.code || "")}</pre>`;
  }

  // 进入新步骤时退出默写模式（左列恢复显示），避免上一步的状态残留
  // 同时顺手把残留的 problem-only 清掉：断点续学 / 从"已做题集"返回再开新题等场景
  // 下，problem-only 可能在更早的 loadProblem 里被加上，若之后没人 setLayoutMode("learn")
  // 就清不掉，work-card 会被 CSS 永久 display:none 隐藏，导致红框空白的 bug。
  function resetFocusMode() {
    const grid = document.querySelector(".learn-grid");
    if (!grid) return;
    grid.classList.remove("problem-only"); // 防御：移除残留的题目页布局，恢复双列
    if (grid.classList.contains("typing")) {
      grid.classList.remove("typing"); // 退出默写模式，左列恢复
    }
    // 蜜蜂复位：退出默写时移回中央（清掉 on-left）
    const bee = $("beeSvg");
    if (bee) bee.classList.remove("on-left");
  }

  // 讲解页右列已改为普通「累积长 textarea」（见 renderStepExplain），不再与左列镜像。
  // 左列折叠方块 + 当前步平铺，右列直接预填前面已抄代码 + 当前步增量，不依赖镜像逻辑。

  // 先展示这一步的讲解与代码（听/朗读 + 抄写 + 下一步默写）
  function renderStepExplain() {
    const p = state.problem, i = state.stepIndex, step = p.steps[i];
    const d = state.drafts[i] || {};
    // 右列 textarea 是「累积长框」：前面所有步骤已抄过的代码（草稿优先，否则题目 code）
    // + 当前步增量代码（待抄写）。用户进下一步时前面代码不消失，全部保留在框里继续写。
    let seedCopy;
    if (d.copy != null && d.copy !== "") {
      // 用户编辑过的完整累积（含前面步骤 + 当前步），直接复用，不重复拼接
      seedCopy = d.copy;
    } else {
      let prevCopied = "";
      for (let j = 0; j < i; j++) {
        const dj = state.drafts[j];
        const codeJ = (dj && dj.copy != null && dj.copy !== "") ? dj.copy : (p.steps[j].code || "");
        if (codeJ) prevCopied += (prevCopied ? "\n\n" : "") + codeJ;
      }
      const curSeed = step.incremental_code || step.code || "";
      seedCopy = (prevCopied ? prevCopied + "\n\n" : "") + curSeed;
    }
    recordProgress("steps", i);
    resetFocusMode(); // 进入新步骤先退出默写，左列恢复
    setLayoutMode("learn"); // 移除 problem-only class，恢复双列（断点续学进分步时右列曾被隐藏）
    // 进入下一步默写（先把抄写内容写入前端缓存 + 落库到学习轨迹）
    async function goTyping() {
      const copyText = $("stepCopyCode") ? $("stepCopyCode").value : "";
      (state.drafts[i] = state.drafts[i] || {}).copy = copyText;
      // 抄写内容记到学习轨迹（复用 event 接口，失败不影响学习）
      API.event(p.id, i, "step_copy", { copy: copyText }).catch(() => {});
      API.event(p.id, i, "skip_step");
      toast("跳过朗读，直接开敲～");
      renderStepTyping();
    }
    // —— 左列变为分步讲解内容（保留听/读按钮）——
    renderLeftExplain(step, async () => goTyping());
    // —— 右列：步骤进度感组件（方案 B）+ 抄写框 + 下一步 ——
    const n = p.steps.length;
    const cur = i + 1;
    const lineCount = (s) => (s || "").split("\n").filter((l) => l.length).length;
    const incLines = lineCount(step.incremental_code) || lineCount(step.code);
    const totalLines = p.steps.reduce((a, s) => a + lineCount(s.incremental_code || s.code), 0);
    const pct = n > 1 ? Math.round((cur / n) * 100) : 100;
    $("workCard").innerHTML = `
      <div class="step-progress">
        <div class="step-progress-head">
          <span class="step-progress-label">第 ${cur} / 共 ${n} 步</span>
        </div>
        <div class="step-progress-bar"><i style="width:${pct}%"></i></div>
      </div>
      <textarea class="code copy-ta" id="stepCopyCode" placeholder="📝 前面已抄的代码都在这里，接着往下抄写第 ${cur} 步的代码（边抄边记）">${escapeHtml(seedCopy)}</textarea>
      <button class="btn small skip step-finish">✅ 听完，读完，抄完，我都懂了，下一步默写 →</button>`;
    const copyTa = $("stepCopyCode");
    if (copyTa) {
      enableTab(copyTa);
      // 实时把抄写内容写回前端缓存，保证「再看一眼讲解」来回切不丢
      copyTa.addEventListener("input", () => {
        (state.drafts[i] = state.drafts[i] || {}).copy = copyTa.value;
      });
    }
    // 「下一步默写」按钮（听 + 朗读 + 抄写都完成时点）
    $("workCard").querySelector(".step-finish").onclick = goTyping;
  }

  // 让 textarea 支持 Tab 缩进（默认 Tab 会让焦点跳走，写代码时不可用）
  function enableTab(ta) {
    const INDENT = "    "; // 4 空格缩进
    ta.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const val = ta.value;
      const s = ta.selectionStart, en = ta.selectionEnd;
      const blockSel = s !== en && val.substring(s, en).includes("\n");
      if (blockSel) {
        // 选中跨多行：整块缩进 / 反缩进
        const lineStart = val.lastIndexOf("\n", s - 1) + 1;
        const nl = val.indexOf("\n", en);
        const lineEnd = nl === -1 ? val.length : nl;
        let block = val.substring(lineStart, lineEnd);
        block = e.shiftKey ? block.replace(/^ {1,4}/gm, "") : INDENT + block.replace(/\n/g, "\n" + INDENT);
        ta.setRangeText(block, lineStart, lineEnd, "preserve");
        ta.selectionStart = lineStart;
        ta.selectionEnd = lineStart + block.length;
      } else if (e.shiftKey) {
        // 单行反缩进
        const lineStart = val.lastIndexOf("\n", s - 1) + 1;
        if (val.substring(lineStart, lineStart + INDENT.length) === INDENT) {
          ta.setRangeText("", lineStart, lineStart + INDENT.length, "preserve");
        }
      } else {
        // 光标处插入缩进
        ta.setRangeText(INDENT, s, en, "end");
      }
    });
  }

  // 遮住讲解 -> 敲代码（所有步骤代码在同一个框里；前面步骤预填，用户只续写本步增量）
  function renderStepTyping(prefill = "") {
    const p = state.problem, i = state.stepIndex, step = p.steps[i];
    if (!step) {
      console.error("[renderStepTyping] 步骤不存在:", i, p.steps);
      toast("这一步还没生成，请回到上一步或重新进入分步");
      return;
    }
    const hasInc = !!(step.incremental_code && step.incremental_code.trim());
    const d = state.drafts[i] || {};
    recordProgress("step_typing", i);
    resetFocusMode(); // 进入新步骤先退出默写，左列恢复
    const grid = document.querySelector(".learn-grid");
    if (grid) grid.classList.add("typing"); // 默写：单列居中 + 蜜蜂左移 + 敲码框撑高
    // 默写时蜜蜂飞到左侧（中央位置不挡字）
    const bee = $("beeSvg");
    if (bee) bee.classList.add("on-left");
    const prevCode = (i > 0 && hasInc) ? (p.steps[i - 1].code || "") : "";
    // 已保存的草稿优先：用户之前敲过的内容（含预填的前置代码）直接还原，不丢
    const seed = (d.code != null && d.code !== "")
      ? d.code
      : prevCode + (prefill ? ((prevCode && !prevCode.endsWith("\n") ? "\n" : "") + prefill) : "");
    // 默写时左列显示题目卡（让用户看着题目默写，讲解已遮住）
    // 不能调 renderProblemCard：它依赖 pSeq/pStatement/pReveal/pRevealBtn/problemAudio 等 id，
    // 而讲解页 renderLeftExplain 用 left.innerHTML = ... 把 problemCard 内部整体替换了，
    // 这些 id 全部变成 null，再调 renderProblemCard 会抛 "Cannot set properties of null"。
    // 改为直接重建左列内部为纯题目卡（不含音频行，默写时不需要听题/朗读题目按钮）。
    const exs = (p.content.examples || []).map((e, idx) =>
      `<div class="example"><b>示例 ${idx + 1}</b><br/>` +
      `<code>输入：${escapeHtml(e.input || "")}</code><br/>` +
      `<code>输出：${escapeHtml(e.output || "")}</code>` +
      (e.explanation ? `<br/><span class="muted">${escapeHtml(e.explanation)}</span>` : "") +
      `</div>`).join("");
    const cons = (p.content.constraints || []);
    const consHtml = cons.length
      ? `<b>约束：</b><ul>${cons.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
      : "";
    $("problemCard").innerHTML = `
      <div class="problem-head">
        <span class="seq-badge">#${p.seq}</span>
        <h2>${escapeHtml(p.title)}</h2>
        <span class="diff-badge">${escapeHtml(p.difficulty || "")}</span>
      </div>
      <div class="statement">${escapeHtml(p.content.statement || "")}</div>
      <div class="reveal collapsed">
        <div class="examples">${exs}</div>
        <div class="constraints">${consHtml}</div>
      </div>`;
    // —— 右列敲码框（默写时左列已重新渲染为题目卡，无需再渲染左列讲解上下文）——
    $("workCard").innerHTML = `
      ${stepDots(i)}
      <div class="section-title">📝 默写第 ${i + 1} 步的<b>代码</b></div>
      <textarea class="code" id="stepCode">${escapeHtml(seed)}</textarea>
      <div id="reviewArea"></div>
      <div class="audio-row">
        <button class="btn primary" id="submitStep">✅ 敲完第${i + 1}步了</button>
        <button class="btn small ghost" id="peekStep">👀 再看一眼讲解</button>
      </div>`;
    const ta = $("stepCode");
    ta.focus();
    enableTab(ta); // 支持 Tab 缩进
    // 实时把默写内容写回前端缓存，保证「再看一眼讲解」来回切不丢
    ta.addEventListener("input", () => {
      (state.drafts[i] = state.drafts[i] || {}).code = ta.value;
    });
    // 光标放到 seed 末尾，方便直接续写
    ta.setSelectionRange(seed.length, seed.length);
    // 「再看一眼讲解」：先把当前默写框内容存回缓存，再回讲解页（讲解页会从缓存回填抄写框）
    $("peekStep").onclick = () => {
      (state.drafts[i] = state.drafts[i] || {}).code = ta.value;
      renderStepExplain();
    };
    $("submitStep").onclick = () => submitStep();
    // 敲码框与左列对齐由 CSS 完成
  }

  async function submitStep() {
    const p = state.problem, i = state.stepIndex;
    const code = $("stepCode").value; // 现在框里就是完整代码（前面预填 + 用户续写）
    delete state.drafts[i]; // 这一步已提交，草稿使命完成
    const btn = $("submitStep"); btn.disabled = true;
    $("reviewArea").innerHTML = '<div class="muted"><span class="spinner"></span> 审查小蜜蜂正在审查…</div>';
    let res;
    try { res = await API.review(p.id, i, code, false); }
    catch (e) { toast("审查失败"); btn.disabled = false; return; }
    finishReview(res, "step");
  }

  // 审查结束后统一：先停顿让客户看懂，再点"我懂了，下一步吧"才继续（大小错都如此）
  async function finishReview(res, scope) {
    renderReview(res, scope);
    if (!res.passed && scope === "step") {
      appendRetry(); // 大/小错都附上这一步的重新讲解，帮助看懂
    }
    if (!res.passed && scope === "final") {
      $("reviewArea").innerHTML += `<div class="review-box minor"><b>🔁 对照一下：</b>可以回到上方讲解，把解法再理一遍。</div>`;
    }
    if (res.passed) {
      await Bee.say(res.severity === "none" ? "完美！这一步敲对啦！" : "不错，思路对了，小问题我标出来啦～");
    } else {
      await Bee.say("看看审查意见，想清楚哪里错了；懂了就点「我懂了，下一步吧」。");
    }
    showReviewNextButton(async () => {
      if (scope === "step") {
        const p = state.problem, i = state.stepIndex;
        if (i + 1 < p.steps.length) { state.stepIndex = i + 1; renderStepExplain(); }
        else { goFinal(); }
      } else {
        await advanceAfterFinal(res);
      }
    });
  }

  // 整题作答"下一步"：标记完成并进入下一题 / 通关
  async function advanceAfterFinal(res) {
    const p = state.problem;
    const doneRes = await API.done(p.id);
    state.doneCount = doneRes.done_count; updateProgress();
    await Bee.say("好，这道题先记到这儿，我采到一点蜜啦🍯");
    await sleep(400);
    if (doneRes.all_done) { showFinish(); return; }
    await Bee.say("我们进入下一题吧！");
    const next = await API.start(null);
    if (next.finished) { showFinish(); return; }
    loadProblem(next.problem);
  }

  function appendRetry() {
    const step = state.problem.steps[state.stepIndex];
    const area = $("reviewArea");
    area.innerHTML += `
      <div class="review-box minor">
        <b>🔁 重新讲一遍这一步：</b><br/>${escapeHtml(step.explanation || "")}
        <pre class="code">${escapeHtml(step.code || "")}</pre>
      </div>`;
  }

  // 在审查结果下方放置"我懂了，下一步吧"按钮（停顿，由用户主动点击推进）
  function showReviewNextButton(cb) {
    const area = $("reviewArea");
    const wrap = document.createElement("div");
    wrap.className = "audio-row";
    wrap.style.marginTop = "12px";
    wrap.innerHTML = `<button class="btn primary" id="reviewNext">🙌 我懂了，下一步吧</button>`;
    area.appendChild(wrap);
    $("reviewNext").onclick = cb;
  }

  function renderReview(res, scope) {
    const area = $("reviewArea");
    const label = { none: "✅ 完全正确", minor: "🟡 有小问题", major: "🔴 错误较大" }[res.severity] || "";
    area.innerHTML = `
      <div class="review-box ${res.severity}">
        <b>${label}</b><br/>${escapeHtml(res.review.feedback || "")}
        ${res.review.hint ? `<br/><span class="muted">提示：${escapeHtml(res.review.hint)}</span>` : ""}
      </div>`;
  }

  // ---------------------------------------------------------- 最终整题作答
  function goFinal() {
    const p = state.problem;
    recordProgress("final", -1);
    setLayoutMode("learn"); // 防御：若之前 problem-only 残留，恢复双列避免 workCard 被 CSS 隐藏
    $("workCard").innerHTML = `
      <div class="section-title">🏁 最后一关：默写完整代码</div>
      <div class="muted" style="margin-bottom:6px">所有步骤都学完啦，现在把完整解法独立敲出来。</div>
      <textarea class="code" id="finalCode" placeholder="# 完整解法…"></textarea>
      <div id="reviewArea"></div>
      <div class="audio-row">
        <button class="btn primary" id="submitFinal">✅ 提交答案</button>
      </div>`;
    Bee.say("所有步骤都学完啦！现在独立把完整代码默写出来吧。");
    $("finalCode").focus();
    enableTab($("finalCode")); // 支持 Tab 缩进
    $("submitFinal").onclick = submitFinal;
    // 整题作答框对齐由 CSS 完成
  }

  async function submitFinal() {
    const p = state.problem;
    const code = $("finalCode").value;
    const btn = $("submitFinal"); btn.disabled = true;
    $("reviewArea").innerHTML = '<div class="muted"><span class="spinner"></span> 审查小蜜蜂正在审查…</div>';
    let res;
    try { res = await API.review(p.id, -1, code, true); }
    catch (e) { toast("审查失败"); btn.disabled = false; return; }
    finishReview(res, "final");
  }

  // ---------------------------------------------------------- 已做题集 / 复习轨迹
  $("btnArchive").addEventListener("click", () => {
    if ($("btnArchive").dataset.mode === "return") returnToLearn();
    else openArchive();
  });
  // 从「已做题集」页返回学习页：若仍有正在学习的题，回到该题；否则进入开始盒子
  function returnToLearn() {
    if (state.problem) {
      showScreen("screenLearn");
      Bee.hideHand();
    } else {
      enterStartBox(false);
    }
  }
  async function openArchive() {
    showScreen("screenArchive");
    const data = await API.problems();
    const list = $("archiveList");
    if (!data.problems.length) { list.innerHTML = '<div class="muted">还没有学习记录～</div>'; return; }
    list.innerHTML = data.problems.map((p) => `
      <div class="arch-item" data-id="${p.id}">
        <span class="seq-badge">#${p.seq}</span>
        <span>${escapeHtml(p.title)}</span>
        <span class="status-dot ${p.status === "done" ? "done" : "learning"}">${p.status === "done" ? "✅ 已学完" : "🟡 学习中"}</span>
      </div>`).join("");
    list.querySelectorAll(".arch-item").forEach((it) =>
      it.onclick = () => {
        list.querySelectorAll(".arch-item").forEach((x) => x.classList.remove("active"));
        it.classList.add("active");
        showTrajectory(Number(it.getAttribute("data-id")));
      });
  }

  const TYPE_LABEL = {
    problem_generated: "出题：生成题目", problem_started: "开始学习",
    listen_problem: "听题", read_problem: "朗读题目", skip_problem: "跳过朗读题目",
    explanation_generated: "生成讲解", listen_example: "听例子", read_example: "朗读例子", skip_example: "跳过朗读例子",
    steps_generated: "生成分步", listen_step: "听某步", read_step: "朗读某步", skip_step: "跳过朗读某步",
    step_copy: "抄写内容", code_reviewed: "代码审查", problem_done: "完成本题",
  };

  async function showTrajectory(pid) {
    const d = await API.trajectory(pid);
    $("archiveDetailTitle").textContent = `#${d.problem.seq} 《${d.problem.title}》 学习轨迹`;
    // 合并事件与提交，按时间排序，原封不动重现
    const items = [];
    (d.events || []).forEach((e) => items.push({ t: e.created_at, kind: "event", data: e }));
    (d.submissions || []).forEach((s) => items.push({ t: s.created_at, kind: "sub", data: s }));
    items.sort((a, b) => a.t - b.t);
    let html = `<div class="traj-item"><div class="t-type">📄 题目</div><div class="explain-text">${escapeHtml(d.problem.content.statement || "")}</div></div>`;
    if (d.problem.explanation) {
      const e = d.problem.explanation;
      // 兼容旧缓存：可能是字符串
      const expText = typeof e === "string" ? e : (e.explanation || "");
      const golden = typeof e === "string" ? "" : (e.golden_quote || "");
      const concepts = typeof e === "string" ? [] : (e.key_concepts || []);
      const diagram = typeof e === "string" ? null : (e.diagram || null);
      html += `<div class="traj-item"><div class="t-type">💡 当时的讲解</div>
        <div class="explain-text">${renderMarkdown(expText)}</div>
        ${diagram ? renderDiagram(diagram) : ""}
        ${concepts.length ? renderKeyConcepts(concepts) : ""}
        ${golden ? `<div class="golden">🌼 ${renderInline(golden)}</div>` : ""}
      </div>`;
    }
    items.forEach((it) => {
      const time = new Date(it.t * 1000).toLocaleString("zh-CN");
      if (it.kind === "event") {
        if (it.data.type === "step_copy" && it.data.payload && it.data.payload.copy) {
          const scope = it.data.step_index === -1 ? "整题" : `第${it.data.step_index + 1}步`;
          html += `<div class="traj-item"><span class="t-time">${time}</span>
            <div class="t-type">📝 抄写(${scope})</div>
            <pre class="code">${escapeHtml(it.data.payload.copy)}</pre></div>`;
        } else {
          html += `<div class="traj-item"><span class="t-time">${time}</span>
            <div class="t-type">• ${TYPE_LABEL[it.data.type] || it.data.type}</div></div>`;
        }
      } else {
        const s = it.data;
        const label = { none: "✅完全正确", minor: "🟡小问题", major: "🔴错误较大" }[s.severity] || s.severity;
        const scope = s.step_index === -1 ? "整题" : `第${s.step_index + 1}步`;
        html += `<div class="traj-item"><span class="t-time">${time}</span>
          <div class="t-type">⌨️ 敲码(${scope}) · ${label}</div>
          <pre class="code">${escapeHtml(s.code || "")}</pre>
          <div class="muted">审查：${escapeHtml((s.review && s.review.feedback) || "")}</div></div>`;
      }
    });
    $("archiveDetail").innerHTML = html;
  }

  // ---------------------------------------------------------- 通关仪式
  async function showFinish() {
    showScreen("screenFinish");
    Bee.setWinding(false);
    $("finishWords").textContent =
      "每一道题就像一朵花，你每做完一道，我就采一点蜜。如今你都学完了，我采的蜂蜜就都送你了。下次再见了～ 🍯";
    await Bee.say("你的力扣学习之旅到此结束。发条停下了，但你已经飞得很高了。");
    await sleep(400);
    await Bee.say("每一道题就像一朵花，你每做完一道，我就采一点蜜。如今你都学完了，我采的蜂蜜就都送你了。下次再见啦！", { keep: true });
  }

  // ---------------------------------------------------------- 工具
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 轻量 Markdown 渲染（专为 lico 讲解设计）
  //   inline: ==短语== (关键词蜜色高亮) / **粗体**
  //   block:  ## 小节标题 / 1. 有序列表 / > 引用 / 👉 提醒
  // 不依赖任何第三方库，错误输入会优雅降级
  function renderInline(text) {
    let s = escapeHtml(text);
    // 关键短语 ==xxx== （蜜色高亮卡片）
    s = s.replace(/==([^=\n]+?)==/g, '<span class="kw">$1</span>');
    // 粗体 **xxx**
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    // 行内代码 `xxx`
    s = s.replace(/`([^`\n]+?)`/g, '<code class="inline-code">$1</code>');
    return s;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // 空行 → 段落分隔
      if (!line.trim()) { out.push(""); i++; continue; }
      // ## 小节标题（前面自动加 emoji 框）
      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) { out.push(`<h3 class="sub-title">${renderInline(h2[1])}</h3>`); i++; continue; }
      // > 引用块
      if (/^>\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s+/.test(lines[i])) {
          buf.push(lines[i].replace(/^>\s+/, ""));
          i++;
        }
        out.push(`<blockquote class="quote">${renderInline(buf.join(" "))}</blockquote>`);
        continue;
      }
      // 有序列表 1. / 2.
      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s+/, ""));
          i++;
        }
        out.push("<ol class=" + JSON.stringify("md-list") + ">" +
          items.map((t) => `<li>${renderInline(t)}</li>`).join("") + "</ol>");
        continue;
      }
      // 无序列表 - / 👉
      if (/^[-•👉]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-•👉]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^[-•👉]\s+/, ""));
          i++;
        }
        out.push("<ul class=" + JSON.stringify("md-list") + ">" +
          items.map((t) => `<li>${renderInline(t)}</li>`).join("") + "</ul>");
        continue;
      }
      // 普通段落（合并连续非空行）
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim()
             && !/^##\s+/.test(lines[i]) && !/^>\s+/.test(lines[i])
             && !/^\d+\.\s+/.test(lines[i]) && !/^[-•👉]\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push(`<p>${renderInline(buf.join(" "))}</p>`);
    }
    return out.join("\n");
  }

  // 关键概念卡片组
  function renderKeyConcepts(concepts) {
    if (!concepts || !concepts.length) return "";
    const items = concepts.map((c) => {
      const text = String(c);
      // 允许后端用 ==短语== 包裹，单个概念也支持
      return `<span class="concept-card">${renderInline(text)}</span>`;
    }).join("");
    return `<div class="concept-row">
      <div class="concept-label">🎯 关键概念</div>
      <div class="concept-items">${items}</div>
    </div>`;
  }

  // 静态示意图渲染：根据后端传来的 type 选 6 套 SVG 模板之一
  function renderDiagram(diagram) {
    if (!diagram || !diagram.type) return "";
    const data = diagram.data || {};
    let body = "";
    try {
      switch (diagram.type) {
        case "linked_list_add":     body = svgLinkedListAdd(data); break;
        case "linked_list_reverse": body = svgLinkedListReverse(data); break;
        case "array_two_pointer":   body = svgArrayTwoPointer(data); break;
        case "binary_tree_traverse":body = svgBinaryTree(data); break;
        case "stack_parenthesis":   body = svgStackParen(data); break;
        case "string_match":        body = svgStringMatch(data); break;
        default: return "";  // 不支持的类型，静默隐藏
      }
    } catch (e) {
      return "";  // 数据异常时优雅降级
    }
    return `<div class="diagram-box">${body}</div>`;
  }

  // SVG 通用：节点方块（蜂蜜主题）
  function svgNode(x, y, label, w = 52, h = 40, fill = "#fffdf6", stroke = "#d69e2e") {
    return `<g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8"
        fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
      <text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle"
        font-size="16" font-weight="700" fill="#2a1404" font-family="-apple-system, system-ui, sans-serif">${escapeHtml(label)}</text>
    </g>`;
  }
  function svgArrow(x1, y1, x2, y2, color = "#d69e2e") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2 - 6}" y2="${y2}" stroke="${color}" stroke-width="2" marker-end="url(#licoArrow)"/>`;
  }
  function svgArrowHead() {
    return `<defs><marker id="licoArrow" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#d69e2e"/>
    </marker></defs>`;
  }

  // 1) 链表加法：l1 / l2 / result 三行节点
  function svgLinkedListAdd(d) {
    const l1 = (d.l1 || []).map(Number);
    const l2 = (d.l2 || []).map(Number);
    const r  = (d.result || []).map(Number);
    const carry = d.carry || 0;
    const W = 60, H = 40, GAP = 18;
    function row(values, y, title, titleColor) {
      const startX = 110;
      let out = `<text x="10" y="${y + H / 2 + 5}" font-size="13" font-weight="800" fill="${titleColor}">${escapeHtml(title)}</text>`;
      values.forEach((v, i) => {
        const x = startX + i * (W + GAP);
        out += svgNode(x, y, String(v), W, H);
        if (i < values.length - 1) out += svgArrow(x + W, y + H / 2, x + W + GAP, y + H / 2);
      });
      return out;
    }
    const width = 110 + Math.max(l1.length, l2.length, r.length) * (W + GAP) + 10;
    return `<svg viewBox="0 0 ${width} 200" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
      ${svgArrowHead()}
      ${row(l1, 20, "链表1", "#b76e00")}
      ${row(l2, 70, "链表2", "#b76e00")}
      <line x1="105" y1="${70 + H + 4}" x2="${width - 10}" y2="${70 + H + 4}" stroke="#d69e2e" stroke-width="1.5"/>
      <text x="10" y="${130 + H / 2 + 5}" font-size="13" font-weight="800" fill="#7a4d00">+ 进位</text>
      <text x="105" y="${130 + H / 2 + 5}" font-size="14" font-weight="800" fill="#5a3500">${carry}</text>
      ${row(r, 150, "结果", "#7a4d00")}
    </svg>`;
  }

  // 2) 链表反转：原链表 + 反转后
  function svgLinkedListReverse(d) {
    const arr = (d.list || []).map(Number);
    const rev = (d.reversed || []).map(Number);
    const W = 60, H = 40, GAP = 18;
    function row(values, y, title) {
      const startX = 110;
      let out = `<text x="10" y="${y + H / 2 + 5}" font-size="13" font-weight="800" fill="#7a4d00">${escapeHtml(title)}</text>`;
      values.forEach((v, i) => {
        const x = startX + i * (W + GAP);
        out += svgNode(x, y, String(v), W, H);
        if (i < values.length - 1) out += svgArrow(x + W, y + H / 2, x + W + GAP, y + H / 2);
      });
      return out;
    }
    const width = 110 + Math.max(arr.length, rev.length) * (W + GAP) + 10;
    return `<svg viewBox="0 0 ${width} 120" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
      ${svgArrowHead()}
      ${row(arr, 20, "原链表")}
      ${row(rev, 80, "反转后")}
    </svg>`;
  }

  // 3) 数组双指针：横排方块 + left/right 标签
  function svgArrayTwoPointer(d) {
    const arr = (d.arr || []).map(Number);
    const left = d.left != null ? Number(d.left) : -1;
    const right = d.right != null ? Number(d.right) : -1;
    const target = d.target;
    const result = d.result;
    const W = 44, H = 44, GAP = 6;
    const startX = 20;
    let cells = "";
    let labels = "";
    arr.forEach((v, i) => {
      const x = startX + i * (W + GAP);
      const isL = i === left, isR = i === right;
      const fill = (isL || isR) ? "#ffe187" : "#fffdf6";
      cells += `<rect x="${x}" y="60" width="${W}" height="${H}" rx="6" fill="${fill}" stroke="#d69e2e" stroke-width="${(isL || isR) ? 2.5 : 1.5}"/>`;
      cells += `<text x="${x + W / 2}" y="${60 + H / 2 + 6}" text-anchor="middle" font-size="15" font-weight="700" fill="#2a1404">${escapeHtml(v)}</text>`;
      // 指针
      if (isL) labels += `<text x="${x + W / 2}" y="48" text-anchor="middle" font-size="12" font-weight="800" fill="#c2410c">L</text>`;
      if (isR) labels += `<text x="${x + W / 2}" y="48" text-anchor="middle" font-size="12" font-weight="800" fill="#1d4ed8">R</text>`;
      if (isL || isR) labels += `<path d="M${x + W / 2} 51 l-4 5 h8 z" fill="${isL ? "#c2410c" : "#1d4ed8"}"/>`;
    });
    let bottom = "";
    if (target != null) bottom += `<text x="20" y="130" font-size="12" font-weight="700" fill="#5a3500">target = ${escapeHtml(target)}</text>`;
    if (result) bottom += `<text x="20" y="148" font-size="12" font-weight="800" fill="#7a4d00">结果 = ${escapeHtml(String(result))}</text>`;
    const width = startX + arr.length * (W + GAP) + 10;
    return `<svg viewBox="0 0 ${width} 170" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
      ${labels}${cells}${bottom}
    </svg>`;
  }

  // 4) 二叉树遍历：递归生成树形
  function svgBinaryTree(d) {
    // data.tree 是嵌套对象 {val, left, right}；order 是遍历结果数组
    const tree = d.tree;
    const order = d.order || [];
    if (!tree) return "";
    // 布局：递归计算每个节点的 x 坐标（DFS in-order 定位）
    const nodes = [];
    function walk(node, depth, leftBound) {
      if (!node) return leftBound;
      const leftEnd = walk(node.left, depth + 1, leftBound);
      const x = leftEnd;
      nodes.push({ val: node.val, x, depth });
      const rightStart = leftEnd + 1;
      return walk(node.right, depth + 1, rightStart);
    }
    walk(tree, 0, 0);
    const n = nodes.length;
    const XGAP = 44, YGAP = 56, W = 32, H = 32;
    const width = Math.max(280, n * XGAP + 40);
    const height = 60 + (Math.max(...nodes.map((nd) => nd.depth)) + 1) * YGAP;
    // 连线：找到每个节点的父节点 → 画线
    let lines = "";
    function findParent(node, val, path) {
      if (!node) return null;
      if (node.val === val && path.length) return path;
      return findParent(node.left, val, path + ["L"]) || findParent(node.right, val, path + ["R"]);
    }
    nodes.forEach((nd) => {
      const path = findParent(tree, nd.val, []);
      if (!path) return;
      let parent = tree, parentNode = null;
      for (const dir of path) {
        parentNode = parent;
        parent = parent[dir === "L" ? "left" : "right"];
        if (!parent) break;
      }
      if (!parentNode) return;
      const p = nodes.find((x) => x.val === parentNode.val);
      if (!p) return;
      const x1 = 30 + p.x * XGAP + W / 2, y1 = 30 + p.depth * YGAP + H;
      const x2 = 30 + nd.x * XGAP + W / 2, y2 = 30 + nd.depth * YGAP;
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d69e2e" stroke-width="1.5"/>`;
    });
    // 节点
    let circles = "";
    nodes.forEach((nd) => {
      const cx = 30 + nd.x * XGAP + W / 2, cy = 30 + nd.depth * YGAP + H / 2;
      circles += `<circle cx="${cx}" cy="${cy}" r="16" fill="#fffdf6" stroke="#d69e2e" stroke-width="1.8"/>`;
      circles += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#2a1404">${escapeHtml(String(nd.val))}</text>`;
    });
    // 遍历结果条
    let orderHtml = "";
    if (order.length) {
      const oW = 32, oGAP = 6, oStart = 20;
      order.forEach((v, i) => {
        const x = oStart + i * (oW + oGAP);
        orderHtml += `<rect x="${x}" y="${height - 44}" width="${oW}" height="${oW - 4}" rx="4" fill="#ffe187" stroke="#d69e2e" stroke-width="1.5"/>`;
        orderHtml += `<text x="${x + oW / 2}" y="${height - 44 + oW / 2 + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#2a1404">${escapeHtml(String(v))}</text>`;
      });
      orderHtml = `<text x="20" y="${height - 52}" font-size="12" font-weight="800" fill="#7a4d00">${escapeHtml(d.method || "遍历")} 顺序：</text>` + orderHtml;
    }
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
      ${lines}${circles}${orderHtml}
    </svg>`;
  }

  // 5) 栈括号匹配：垂直栈 + 配对高亮
  function svgStackParen(d) {
    const s = String(d.s || "");
    const pairs = d.pairs || [];  // [[i,j], ...]
    const W = 28, H = 28, GAP = 4;
    const startX = 20;
    let cells = "";
    let label = "";
    for (let i = 0; i < s.length; i++) {
      const x = startX + i * (W + GAP);
      const matched = pairs.some((p) => p[0] === i || p[1] === i);
      const fill = matched ? "#ffe187" : "#fffdf6";
      cells += `<rect x="${x}" y="20" width="${W}" height="${H}" rx="5" fill="${fill}" stroke="#d69e2e" stroke-width="1.5"/>`;
      cells += `<text x="${x + W / 2}" y="${20 + H / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#2a1404">${escapeHtml(s[i])}</text>`;
    }
    label = `<text x="${startX}" y="14" font-size="12" font-weight="800" fill="#7a4d00">字符串</text>`;
    // 配对连线（弧线）
    let arcs = "";
    pairs.forEach((p) => {
      const x1 = startX + p[0] * (W + GAP) + W / 2;
      const x2 = startX + p[1] * (W + GAP) + W / 2;
      const midX = (x1 + x2) / 2;
      const top = 20 + H + 6;
      arcs += `<path d="M${x1} ${top} Q${midX} ${top + 24} ${x2} ${top}" fill="none" stroke="#d69e2e" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    });
    const width = startX + s.length * (W + GAP) + 10;
    return `<svg viewBox="0 0 ${width} 110" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
      ${label}${cells}${arcs}
    </svg>`;
  }

  // 6) 字符串匹配：主串 + 模式串 + 对齐线
  function svgStringMatch(d) {
    const s = String(d.s || "");
    const p = String(d.p || "");
    const matches = d.matches || [];  // [[i, j], ...]
    const W = 26, H = 26, GAP = 4;
    function row(text, y, label) {
      const startX = 60;
      let cells = "";
      for (let i = 0; i < text.length; i++) {
        const x = startX + i * (W + GAP);
        const isMatch = matches.some((m) => i >= m[0] && i < m[0] + p.length);
        const fill = isMatch ? "#ffe187" : "#fffdf6";
        cells += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" fill="${fill}" stroke="#d69e2e" stroke-width="1.5"/>`;
        cells += `<text x="${x + W / 2}" y="${y + H / 2 + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#2a1404">${escapeHtml(text[i])}</text>`;
      }
      return `<text x="20" y="${y + H / 2 + 4}" font-size="12" font-weight="800" fill="#7a4d00">${escapeHtml(label)}</text>${cells}`;
    }
    const width = 60 + Math.max(s.length, p.length) * (W + GAP) + 10;
    return `<svg viewBox="0 0 ${width} 90" xmlns="http://www.w3.org/2000/svg" class="diagram-svg">
      ${row(s, 16, "主串")}
      ${row(p, 56, "模式")}
    </svg>`;
  }

  init();
})();
