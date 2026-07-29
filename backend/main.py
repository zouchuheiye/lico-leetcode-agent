"""FastAPI 主入口：REST 接口 + 托管前端静态文件。

前后端分离：后端只提供 JSON 接口与静态资源，前端为独立 SPA。
"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import agents
import storage
from config import DEEPSEEK_MODEL_LABEL, DEEPSEEK_MODEL, FRONTEND_DIR, TOTAL_PROBLEMS, PROVIDER_PRESETS

app = FastAPI(title="Lico 力扣手撕辅导 Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    storage.init_db()


# ------------------------------------------------------------ 数据模型
class KeyBody(BaseModel):
    api_key: str


class ConfigSaveBody(BaseModel):
    provider: str = "deepseek"
    base_url: str = ""
    model_name: str = ""
    api_key: str = ""
    language: str = "python"


class StartBody(BaseModel):
    seq: int | None = None
    language: str = "python"


class ProblemBody(BaseModel):
    problem_id: int
    language: str = "python"


class EventBody(BaseModel):
    problem_id: int
    step_index: int = -1
    type: str
    payload: dict | None = None


class ReviewBody(BaseModel):
    problem_id: int
    step_index: int = -1
    code: str
    is_final: bool = False
    language: str = "python"


def _key() -> str:
    return storage.get_config("deepseek_key") or ""


# ------------------------------------------------------------ 配置 / 状态
@app.get("/api/status")
def status():
    cur = storage.get_current_problem()
    provider = storage.get_config("model_provider") or "deepseek"
    base_url = storage.get_config("model_base_url") or ""
    model_name = storage.get_config("model_name") or DEEPSEEK_MODEL
    language = storage.get_config("model_language") or "python"
    model_label = model_name or DEEPSEEK_MODEL_LABEL
    return {
        "configured": bool(_key()),
        "model_label": model_label,
        "provider": provider,
        "base_url": base_url,
        "model_name": model_name,
        "language": language,
        "done_count": storage.count_done(),
        "total": TOTAL_PROBLEMS,
        "next_seq": storage.next_seq_to_learn(),
        "resume_seq": cur["seq"] if cur else None,
    }


@app.get("/api/config")
def get_config():
    """返回当前模型配置（不回传明文 Key，仅告知是否已保存）。"""
    return {
        "provider": storage.get_config("model_provider") or "deepseek",
        "base_url": storage.get_config("model_base_url") or "",
        "model_name": storage.get_config("model_name") or "",
        "language": storage.get_config("model_language") or "python",
        "has_key": bool(_key()),
    }


@app.post("/api/config/test")
def config_test(body: KeyBody):
    """连接测试。成功=发条转动并保存 Key；失败=发条卡住。"""
    result = agents.test_connection(body.api_key)
    if result.get("ok"):
        storage.set_config("deepseek_key", body.api_key.strip())
    return result


@app.post("/api/config/save")
def config_save(body: ConfigSaveBody):
    """保存完整模型配置：解析 Base URL/模型名 -> 测连 -> 落 config 表。"""
    preset = PROVIDER_PRESETS.get(body.provider, PROVIDER_PRESETS["custom"])
    base_url = body.base_url.strip() or preset["base_url"]
    model_name = body.model_name.strip() or preset["model"]
    if not base_url or not model_name:
        return {"ok": False, "error": "请填写 Base URL 与模型名（或选择有预设的服务商）。"}
    # Key：传入优先，否则沿用已保存
    api_key = body.api_key.strip() or _key()
    if not api_key:
        return {"ok": False, "error": "请填写 API Key。"}
    result = agents.test_connection(api_key, base_url, model_name)
    if not result.get("ok"):
        return result
    storage.set_config("model_provider", body.provider)
    storage.set_config("model_base_url", base_url)
    storage.set_config("model_name", model_name)
    storage.set_config("model_language", body.language)
    storage.set_config("deepseek_key", api_key)
    return {"ok": True, "model_label": model_name or DEEPSEEK_MODEL_LABEL}


# ------------------------------------------------------------ 学习流程
@app.post("/api/learn/start")
def learn_start(body: StartBody):
    """开始学习某一题：优先续学进行中的题目（断点续学），否则生成/读取下一题。"""
    current = storage.get_current_problem()
    if current:
        # 存在未学完的题目 -> 从中断处继续，绝不放过
        storage.add_event(current["id"], -1, "problem_resumed", None)
        return {
            "finished": False,
            "problem": current,
            "resume": True,
            "checkpoint": current.get("checkpoint"),
        }
    seq = body.seq or storage.next_seq_to_learn()
    if seq > TOTAL_PROBLEMS:
        return {"finished": True}
    problem = storage.get_problem_by_seq(seq)
    if problem is None:
        try:
            content = agents.gen_problem(_key(), seq, body.language)
        except agents.AgentError as e:
            raise HTTPException(status_code=502, detail=str(e))
        problem = storage.create_problem(
            seq=seq,
            slug=content["slug"],
            title=content["title"],
            difficulty=content["difficulty"],
            content={
                "statement": content.get("statement", ""),
                "examples": content.get("examples", []),
                "constraints": content.get("constraints", []),
            },
        )
        storage.add_event(problem["id"], -1, "problem_generated", {"seq": seq})
    storage.add_event(problem["id"], -1, "problem_started", {"seq": seq})
    return {"finished": False, "problem": problem, "resume": False, "checkpoint": None}


@app.post("/api/learn/explain")
def learn_explain(body: ProblemBody):
    problem = storage.get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "题目不存在")
    if problem.get("explanation"):
        return {"explanation": problem["explanation"]}
    try:
        explanation = agents.gen_explanation(_key(), problem, body.language)
    except agents.AgentError as e:
        raise HTTPException(status_code=502, detail=str(e))
    storage.save_explanation(problem["id"], explanation)
    storage.add_event(problem["id"], -1, "explanation_generated", None)
    return {"explanation": explanation}


@app.post("/api/learn/steps")
def learn_steps(body: ProblemBody):
    problem = storage.get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "题目不存在")
    if problem.get("steps"):
        return {"steps": problem["steps"]}
    try:
        steps = agents.gen_steps(_key(), problem, problem.get("explanation") or "", body.language)
    except agents.AgentError as e:
        raise HTTPException(status_code=502, detail=str(e))
    storage.save_steps(problem["id"], steps)
    storage.add_event(problem["id"], -1, "steps_generated", {"count": len(steps)})
    return {"steps": steps}


@app.post("/api/learn/review")
def learn_review(body: ReviewBody):
    problem = storage.get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "题目不存在")
    step = None
    if not body.is_final and problem.get("steps"):
        for s in problem["steps"]:
            if s["index"] == body.step_index:
                step = s
                break
    try:
        review = agents.review_code(_key(), problem, step, body.code, body.is_final, body.language)
    except agents.AgentError as e:
        raise HTTPException(status_code=502, detail=str(e))
    saved = storage.add_submission(problem["id"], body.step_index, body.code, review)
    storage.add_event(problem["id"], body.step_index, "code_reviewed",
                      {"severity": saved["severity"], "passed": saved["passed"]})
    return saved


@app.post("/api/event")
def record_event(body: EventBody):
    storage.add_event(body.problem_id, body.step_index, body.type, body.payload)
    return {"ok": True}


class ProgressBody(BaseModel):
    problem_id: int
    phase: str
    step_index: int = -1


@app.post("/api/learn/progress")
def learn_progress(body: ProgressBody):
    """保存断点：记录当前进行到的阶段与步骤。"""
    storage.save_checkpoint(body.problem_id, body.phase, body.step_index)
    return {"ok": True}


@app.post("/api/learn/done")
def learn_done(body: ProblemBody):
    problem = storage.get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "题目不存在")
    storage.mark_done(problem["id"])
    storage.add_event(problem["id"], -1, "problem_done", None)
    done = storage.count_done()
    return {"done_count": done, "total": TOTAL_PROBLEMS, "all_done": done >= TOTAL_PROBLEMS}


# ------------------------------------------------------------ 已做题集 / 复习
@app.get("/api/problems")
def problems():
    return {"problems": storage.list_problems(),
            "done_count": storage.count_done(), "total": TOTAL_PROBLEMS}


@app.get("/api/trajectory/{problem_id}")
def trajectory(problem_id: int):
    traj = storage.get_full_trajectory(problem_id)
    if not traj:
        raise HTTPException(404, "题目不存在")
    return traj


# ------------------------------------------------------------ 前端托管
if os.path.isdir(FRONTEND_DIR):
    # 开发期禁用静态资源缓存，保证每次刷新都拉到最新文件
    class NoCacheStaticFiles(StaticFiles):
        async def get_response(self, path, scope):
            resp = await super().get_response(path, scope)
            resp.headers.setdefault("Cache-Control", "no-store")
            return resp

    app.mount("/static", NoCacheStaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def index():
        return FileResponse(
            os.path.join(FRONTEND_DIR, "index.html"),
            headers={"Cache-Control": "no-store"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
