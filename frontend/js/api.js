// 与后端 REST 接口通信的薄封装
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
  start(seq) { return this._post("/api/learn/start", { seq }); },
  explain(problem_id) { return this._post("/api/learn/explain", { problem_id }); },
  steps(problem_id) { return this._post("/api/learn/steps", { problem_id }); },
  review(problem_id, step_index, code, is_final) {
    return this._post("/api/learn/review", { problem_id, step_index, code, is_final });
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
