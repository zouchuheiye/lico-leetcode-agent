"""四个 AI Agent + DeepSeek-V4 客户端。

- 出题 Agent：生成/整理一道力扣题的规范题面。
- 讲解 Agent：形象生动又简洁明了的讲解，并提炼哲学金句。
- 分解 Agent：按难度把解法拆成若干步骤，每一行代码都注释"为什么"。
- 审查 Agent：审查用户敲的代码，判断错误大小（none/minor/major）并给反馈。

在线以 DeepSeek 为主；任何异常都回退到 fallback，保证流程不中断。
"""
import json
import re
from typing import Optional

import httpx

from config import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, REQUEST_TIMEOUT
import fallback_problems as fb


# ---------------------------------------------------------------- 底层调用
def test_connection(api_key: str) -> dict:
    """连接测试：Key 有效返回 ok=True（对应发条转动）。"""
    if not api_key or not api_key.strip():
        return {"ok": False, "error": "Key 为空，发条上不了。"}
    try:
        resp = httpx.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {api_key.strip()}",
                     "Content-Type": "application/json"},
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
                "stream": False,
            },
            timeout=20,
        )
        if resp.status_code == 200:
            return {"ok": True}
        if resp.status_code in (401, 403):
            return {"ok": False, "error": "Key 无效或无权限，发条卡住了。"}
        return {"ok": False, "error": f"连接失败（HTTP {resp.status_code}），发条卡住了。"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"网络异常：{e}"}


def _chat(api_key: str, system: str, user: str, temperature: float = 0.5,
          json_mode: bool = True) -> Optional[str]:
    """调用 DeepSeek chat；失败返回 None 交由上层 fallback。"""
    if not api_key:
        return None
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "stream": False,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    try:
        resp = httpx.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {api_key.strip()}",
                     "Content-Type": "application/json"},
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        return resp.json()["choices"][0]["message"]["content"]
    except Exception:  # noqa: BLE001
        return None


def _parse_json(text: Optional[str]) -> Optional[dict]:
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:  # noqa: BLE001
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:  # noqa: BLE001
                return None
    return None


# ---------------------------------------------------------------- 出题 Agent
def gen_problem(api_key: str, seq: int) -> dict:
    slug, title, difficulty = fb.FALLBACK_TITLES[(seq - 1) % len(fb.FALLBACK_TITLES)]
    system = (
        "你是资深的力扣出题官。请输出一道经典力扣题目的规范中文题面，"
        "只返回 JSON，字段：statement(题目描述), examples(数组，每项含 input/output/explanation), "
        "constraints(约束数组)。语言简洁、准确。"
    )
    user = f"请给出力扣题《{title}》(编号顺序第{seq}题, 难度{difficulty})的完整规范题面。"
    data = _parse_json(_chat(api_key, system, user, temperature=0.3))
    if data and data.get("statement"):
        return {"slug": slug, "title": title, "difficulty": difficulty,
                "statement": data.get("statement"),
                "examples": data.get("examples", []),
                "constraints": data.get("constraints", [])}
    return fb.fallback_content(seq)


# ---------------------------------------------------------------- 讲解 Agent
def gen_explanation(api_key: str, problem: dict) -> dict:
    system = (
        "你是最会讲题的算法讲解员小蜜蜂 lico，讲解形象生动又简洁明了。"
        "只返回 JSON，字段：explanation(核心思路讲解，用比喻，通俗), "
        "worked_example(用一个具体例子一步步演算), "
        "golden_quote(从这道题中提炼出的一句哲学金句，让人真正理解这道题的精髓)。"
    )
    user = (
        f"题目：{problem['title']}\n"
        f"描述：{problem['content'].get('statement','')}\n"
        "请讲解这道题。"
    )
    data = _parse_json(_chat(api_key, system, user, temperature=0.6))
    if data and data.get("explanation"):
        return {
            "explanation": data.get("explanation"),
            "worked_example": data.get("worked_example", ""),
            "golden_quote": data.get("golden_quote", ""),
        }
    return fb.fallback_explanation(problem["slug"])


# ---------------------------------------------------------------- 分解 Agent
def gen_steps(api_key: str, problem: dict) -> list:
    system = (
        "你擅长把算法代码按难度拆解成循序渐进的若干步骤（3~5步）。"
        "只返回 JSON，字段：steps(数组)。每个 step 含："
        "index(从0开始的序号), title(该步标题), explanation(这一步在做什么), "
        "incremental_code(【本步新增】的 Python 代码，只写这一步新加的部分，"
        "不要重复写之前步骤已有的代码；逐行都要有中文注释解释为什么这么写)。"
        "注意：第 0 步的 incremental_code 就是完整函数开头；后续每一步只写在上一步基础上新追加的行。"
        "最后一步应是让整段代码成为完整可运行解法的那次追加。"
    )
    user = (
        f"题目：{problem['title']}\n"
        f"描述：{problem['content'].get('statement','')}\n"
        "请给出分步手撕方案，每步只给增量代码。"
    )
    data = _parse_json(_chat(api_key, system, user, temperature=0.4))
    if data and isinstance(data.get("steps"), list) and data["steps"]:
        raw = data["steps"]
        # 模型优先返回 incremental_code（推荐）；若给了累积 code 则兜底剥离
        if all((s.get("incremental_code") or "").strip() for s in raw):
            cum = ""
            steps = []
            for i, s in enumerate(raw):
                inc = s.get("incremental_code", "") or ""
                cum = (cum + "\n" if cum else "") + inc
                steps.append({
                    "index": i,
                    "title": s.get("title", f"第{i+1}步"),
                    "explanation": s.get("explanation", ""),
                    "code": cum,
                    "incremental_code": inc,
                })
            return steps
        # 模型返回的是累积 code：剥出增量
        steps = []
        for i, s in enumerate(raw):
            steps.append({
                "index": i,
                "title": s.get("title", f"第{i+1}步"),
                "explanation": s.get("explanation", ""),
                "code": s.get("code", "") or "",
            })
        _annotate_incremental(steps)
        return steps
    # 兜底：离线题库提供的是累积代码，剥出增量
    steps = fb.fallback_steps(problem["slug"])
    _annotate_incremental(steps)
    return steps


def _annotate_incremental(steps: list) -> None:
    """离线兜底用：由累积代码剥出 incremental_code（之前步骤已写、无需重敲的部分）。"""
    prev = ""
    for s in steps:
        code = s.get("code", "") or ""
        inc = s.get("incremental_code", "")
        if not inc:
            inc = _strip_prefix(code, prev)
        s["incremental_code"] = inc
        prev = code


def _strip_prefix(code: str, prev: str) -> str:
    if not prev:
        return code
    cl = code.split("\n")
    pl = prev.split("\n")
    if cl[: len(pl)] == pl:
        return "\n".join(cl[len(pl):])
    return code


# ---------------------------------------------------------------- 审查 Agent
def review_code(api_key: str, problem: dict, step: Optional[dict], user_code: str,
                is_final: bool) -> dict:
    reference = ""
    if is_final and problem.get("steps"):
        reference = problem["steps"][-1].get("code", "")
    elif step:
        reference = step.get("code", "")

    system = (
        "你是严格但温暖的代码审查员小蜜蜂 lico。审查用户手敲的代码。"
        "只返回 JSON，字段：severity(none=完全正确/minor=有小问题但思路对/major=错误较大), "
        "feedback(中文反馈，指出对错与原因), hint(若需重敲，给一句提示)。"
        "评判标准：思路正确、关键逻辑到位即可判 none 或 minor；"
        "只有逻辑缺失、方向错误、无法运行才判 major。"
    )
    scope = "整道题的最终完整代码" if is_final else f"第{(step or {}).get('index',0)+1}步"
    user = (
        f"题目：{problem['title']}\n"
        f"当前审查范围：{scope}\n"
        f"参考代码：\n{reference}\n\n"
        f"用户敲的代码：\n{user_code}\n\n"
        "请审查。"
    )
    data = _parse_json(_chat(api_key, system, user, temperature=0.2))
    if data and data.get("severity") in ("none", "minor", "major"):
        return {
            "severity": data["severity"],
            "feedback": data.get("feedback", ""),
            "hint": data.get("hint", ""),
        }
    return _heuristic_review(user_code, reference, is_final)


def _heuristic_review(user_code: str, reference: str, is_final: bool) -> dict:
    """离线兜底审查：基于关键词/结构的粗略判断。"""
    code = (user_code or "").strip()
    if len(code) < 10:
        return {"severity": "major", "feedback": "代码几乎是空的，还没开始敲呢。",
                "hint": "先照着讲解，把这一步的核心逻辑写出来。"}
    # 提取参考代码里的关键标识符
    ref_tokens = set(re.findall(r"[A-Za-z_]{3,}", reference or ""))
    user_tokens = set(re.findall(r"[A-Za-z_]{3,}", code))
    if not ref_tokens:
        return {"severity": "minor", "feedback": "已收到你的代码，思路看起来在正轨上。", "hint": ""}
    overlap = len(ref_tokens & user_tokens) / max(1, len(ref_tokens))
    if overlap >= 0.6:
        return {"severity": "none", "feedback": "很棒，关键逻辑都到位了！", "hint": ""}
    if overlap >= 0.3:
        return {"severity": "minor", "feedback": "大方向对了，个别细节可以再对照讲解检查一下。", "hint": ""}
    return {"severity": "major",
            "feedback": "和这一步的核心逻辑差距较大，可能漏了关键部分。",
            "hint": "回看上面的讲解，注意关键的数据结构和循环逻辑。"}
