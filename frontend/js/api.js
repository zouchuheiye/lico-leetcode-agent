// 与后端 REST 接口通信的薄封装

// 当前选用的编程语言（讲解/分步/审查都用此语言；解耦于学习轨迹）
function _getLang() {
  try { return localStorage.getItem("lico-lang") || "python"; } catch { return "python"; }
}

const API = {
  async _post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  },
  async _get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  },
  status() { return this._get("/api/status"); },
  testKey(api_key) { return this._post("/api/config/test", { api_key }); },
  start(seq) { return this._post("/api/learn/start", { seq, language: _getLang() }); },
  explain(problem_id) { return this._post("/api/learn/explain", { problem_id, language: _getLang() }); },
  steps(problem_id) { return this._post("/api/learn/steps", { problem_id, language: _getLang() }); },
  review(problem_id, step_index, code, is_final) {
    return this._post("/api/learn/review", { problem_id, step_index, code, is_final, language: _getLang() });
  },
  event(problem_id, step_index, type, payload) {
    return this._post("/api/event", { problem_id, step_index, type, payload });
  },
  progress(problem_id, phase, step_index) {
    return this._post("/api/learn/progress", { problem_id, phase, step_index });
  },
  done(problem_id) { return this._post("/api/learn/done", { problem_id }); },
  problems() { return this._get("/api/problems"); },
  trajectory(problem_id) { return this._get("/api/trajectory/" + problem_id); },
};
