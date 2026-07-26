// 主流程编排：配置 -> 上发条 -> 开始盒子 -> 手撕学习 -> 已做题集 / 通关
(function () {
  const $ = (id) => document.getElementById(id);
  const screens = ["screenConfig", "screenStartBox", "screenLearn", "screenArchive", "screenFinish"];
  function showScreen(id) {
    screens.forEach((s) => $(s).classList.toggle("hidden", s !== id));
  }
  function toast(msg, ms = 2200) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), ms);
  }

  let state = { problem: null, stepIndex: 0, total: 100, doneCount: 0 };

  // ---------------------------------------------------------- 初始化
  async function init() {
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

  // 三按钮朗读行：🔊 听 / 🗣️ 朗读(点一次变"我朗读结束了"，再点进下一步) / 🚀 不听不读直接下一步
  const AUDIO_ROW = (listenLabel) => `
    <div class="audio-row" data-audio>
      <button class="btn small" data-act="listen">🔊 ${listenLabel}</button>
      <button class="btn small ghost" data-act="read">🗣️ 朗读</button>
      <button class="btn small skip" data-act="skip">🚀 不听不读，我都懂了，下一步 →</button>
    </div>`;

  // 当前正在"听"的按钮（全局唯一，因为浏览器 TTS 同时只能播放一个）
  let activeListenBtn = null;
  function resetListenBtn(btn) {
    if (!btn) return;
    btn.dataset.listening = "";
    btn.textContent = btn.dataset.origText || "🔊 听";
  }

  // 绑定一组朗读行按钮
  function bindAudioRow(parent, { listenText, onListenStart, onReadDone, onSkip }) {
    // 兼容两种结构：父元素自身就是音频行，或音频行是父元素的后代
    const rowEl = (parent.matches && parent.matches("[data-audio]")) ? parent : parent.querySelector("[data-audio]");
    if (!rowEl) return;
    const listenBtn = rowEl.querySelector('[data-act="listen"]');
    listenBtn.dataset.origText = listenBtn.textContent;
    listenBtn.dataset.listening = "";
    listenBtn.onclick = async () => {
      if (listenBtn.dataset.listening === "1") {
        // 再次点击：停止朗读
        Bee.stopSpeak();
        resetListenBtn(listenBtn);
        if (activeListenBtn === listenBtn) activeListenBtn = null;
        return;
      }
      // 开始听：先重置其他可能正在听的按钮
      if (activeListenBtn && activeListenBtn !== listenBtn) resetListenBtn(activeListenBtn);
      activeListenBtn = listenBtn;
      listenBtn.dataset.listening = "1";
      listenBtn.textContent = "🔇 停止听";
      if (onListenStart) onListenStart();
      await Bee.say(listenText);
      if (activeListenBtn === listenBtn) {
        resetListenBtn(listenBtn);
        activeListenBtn = null;
      }
    };
    const readBtn = rowEl.querySelector('[data-act="read"]');
    // 每次绑定都重置"朗读结束"状态，避免上一题残留导致直接跳过
    readBtn.dataset.done = "";
    readBtn.textContent = "🗣️ 朗读";
    readBtn.classList.remove("read-done");
    readBtn.onclick = () => {
      // 朗读/前进时，先把正在播放的"听"停下来
      Bee.stopSpeak();
      if (activeListenBtn) { resetListenBtn(activeListenBtn); activeListenBtn = null; }
      if (readBtn.dataset.done === "1") { onReadDone(); return; }
      readBtn.dataset.done = "1";
      readBtn.textContent = "✅ 我朗读结束了";
      readBtn.classList.add("read-done");
      toast("慢慢读，不着急～读完了就点「我朗读结束了」");
    };
    rowEl.querySelector('[data-act="skip"]').onclick = () => {
      // 跳过时，先把正在播放的"听"停下来
      Bee.stopSpeak();
      if (activeListenBtn) { resetListenBtn(activeListenBtn); activeListenBtn = null; }
      onSkip();
    };
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
    Bee.hideHand();
    renderProblemCard(problem);
    // 复习（已有讲解与步骤）或续学：workCard 先给个占位
    $("workCard").innerHTML = `<div class="work-placeholder">先听题、朗读题目，熟悉之后我来讲解～</div>`;
    if (checkpoint && checkpoint.phase && checkpoint.phase !== "problem") {
      // 断点续学：直接跳到上次中断的阶段
      Bee.say(`我们继续第 ${problem.seq} 题《${problem.title}》——从上次停下的地方接着学。`);
      await sleep(400);
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
    // 绑定「听题 / 朗读题目 / 不听不读」
    const pAudio = $("problemAudio");
    bindAudioRow(pAudio, {
      listenText: `听题开始：${p.content.statement}`,
      onListenStart: () => { API.event(p.id, -1, "listen_problem"); },
      onReadDone: async () => {
        API.event(p.id, -1, "read_problem");
        await Bee.say("很好，你已经熟悉了题目，我开始讲解了！");
        goExplain();
      },
      onSkip: async () => {
        API.event(p.id, -1, "skip_problem");
        toast("跳过朗读，直接开讲～");
        goExplain();
      },
    });
  }

  // ---------------------------------------------------------- 讲解阶段
  async function goExplain() {
    const p = state.problem;
    $("workCard").innerHTML = `<div class="work-placeholder"><span class="spinner"></span> 讲解小蜜蜂正在准备…</div>`;
    let data;
    try { data = await API.explain(p.id); } catch (e) { toast("讲解生成失败"); return; }
    p.explanation = data.explanation;
    recordProgress("explain", -1);
    renderExplain(p.explanation);
  }

  function renderExplain(ex) {
    $("workCard").innerHTML = `
      <div class="section-title">💡 讲解</div>
      <div class="explain-text">${escapeHtml(ex.explanation || "")}</div>
      ${ex.worked_example ? `<div class="section-title" style="margin-top:14px">📐 例子</div>
        <div class="explain-text">${escapeHtml(ex.worked_example)}</div>` : ""}
      <div class="golden">${escapeHtml(ex.golden_quote || "")}</div>
      ${AUDIO_ROW("开始听例子")}`;
    bindAudioRow($("workCard"), {
      listenText: `${ex.explanation}。${ex.worked_example || ""}。记住：${ex.golden_quote || ""}`,
      onListenStart: () => { API.event(state.problem.id, -1, "listen_example"); },
      onReadDone: async () => {
        API.event(state.problem.id, -1, "read_example");
        await Bee.say("很好！接下来我把代码一步一步拆给你，我们开始手撕吧！");
        goSteps();
      },
      onSkip: async () => {
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
    try { data = await API.steps(p.id); } catch (e) { toast("步骤生成失败"); return; }
    p.steps = data.steps || [];
    state.stepIndex = 0;
    renderStepExplain();
  }

  function stepDots(active) {
    const n = state.problem.steps.length;
    let s = '<div class="step-nav">';
    for (let i = 0; i < n; i++) {
      const cls = i < active ? "done" : i === active ? "active" : "";
      s += `<span class="step-dot ${cls}">${i + 1}</span>`;
    }
    s += `<span class="muted" style="margin-left:8px">共 ${n} 步</span></div>`;
    return s;
  }

  // 先展示这一步的讲解与代码（听/朗读）
  function renderStepExplain() {
    const p = state.problem, i = state.stepIndex, step = p.steps[i];
    recordProgress("steps", i);
    $("workCard").innerHTML = `
      ${stepDots(i)}
      <div class="section-title">🧩 ${escapeHtml(step.title)}</div>
      <div class="explain-text">${escapeHtml(step.explanation || "")}</div>
      <pre class="code">${escapeHtml(step.code || "")}</pre>
      ${AUDIO_ROW(`听第${i + 1}步`)}`;
    bindAudioRow($("workCard"), {
      listenText: `第${i + 1}步，${step.title}。${step.explanation}`,
      onListenStart: () => { API.event(p.id, i, "listen_step"); },
      onReadDone: async () => {
        API.event(p.id, i, "read_step");
        toast("朗读完这一步，就把讲解遮住，自己敲一遍～");
        await sleep(300);
        renderStepTyping();
      },
      onSkip: async () => {
        API.event(p.id, i, "skip_step");
        toast("跳过朗读，直接开敲～");
        renderStepTyping();
      },
    });
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
    const hasInc = !!(step.incremental_code && step.incremental_code.trim());
    recordProgress("step_typing", i);
    const prevCode = (i > 0 && hasInc) ? (p.steps[i - 1].code || "") : "";
    const seed = prevCode + (prefill ? ((prevCode && !prevCode.endsWith("\n") ? "\n" : "") + prefill) : "");
    const ph = hasInc
      ? `# 前面步骤的代码已预填在上方，请把光标移到最后，续写第${i + 1}步新增的代码…`
      : `# 在这里敲第${i + 1}步完整代码…`;
    $("workCard").innerHTML = `
      ${stepDots(i)}
      <div class="section-title">✍️ 请敲第 ${i + 1} 步的<b>${hasInc ? "新增" : "完整"}</b>代码</div>
      <div class="muted" style="margin-bottom:6px">${hasInc ? "讲解已遮住。下面是一个代码框，前面步骤已写好的代码已经放在里面；请直接把光标移到最后，续写这一步要新增的内容。" : "讲解已遮住，凭理解把这一步完整写出来。"}</div>
      <textarea class="code" id="stepCode" placeholder="${ph}">${escapeHtml(seed)}</textarea>
      <div id="reviewArea"></div>
      <div class="audio-row">
        <button class="btn primary" id="submitStep">✅ 敲完第${i + 1}步了</button>
        <button class="btn small ghost" id="peekStep">👀 再看一眼讲解</button>
      </div>`;
    const ta = $("stepCode");
    ta.focus();
    enableTab(ta); // 支持 Tab 缩进
    // 光标放到 seed 末尾，方便直接续写
    ta.setSelectionRange(seed.length, seed.length);
    $("peekStep").onclick = () => renderStepExplain();
    $("submitStep").onclick = () => submitStep();
  }

  async function submitStep() {
    const p = state.problem, i = state.stepIndex;
    const code = $("stepCode").value; // 现在框里就是完整代码（前面预填 + 用户续写）
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
  $("btnArchive").addEventListener("click", openArchive);
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
    code_reviewed: "代码审查", problem_done: "完成本题",
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
      html += `<div class="traj-item"><div class="t-type">💡 当时的讲解</div>
        <div class="explain-text">${escapeHtml(d.problem.explanation.explanation || "")}</div>
        <div class="golden">${escapeHtml(d.problem.explanation.golden_quote || "")}</div></div>`;
    }
    items.forEach((it) => {
      const time = new Date(it.t * 1000).toLocaleString("zh-CN");
      if (it.kind === "event") {
        html += `<div class="traj-item"><span class="t-time">${time}</span>
          <div class="t-type">• ${TYPE_LABEL[it.data.type] || it.data.type}</div></div>`;
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

  init();
})();
