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
import storage
import fallback_problems as fb


class AgentError(Exception):
    """Agent 调用模型失败或无有效输出时抛出，由 main.py 转成 502 透传给前端。"""
    pass


# ---------------------------------------------------------------- 底层调用
def test_connection(api_key: str, base_url: str = None, model: str = None) -> dict:
    """连接测试：Key 有效返回 ok=True（对应发条转动）。

    base_url / model 缺省时回退到已保存的配置，再回退到硬编码默认值，
    因此既支持「保存前的即时测连」（显式传入），也兼容旧调用（仅传 Key）。
    """
    if not api_key or not api_key.strip():
        return {"ok": False, "error": "Key 为空，发条上不了。"}
    base_url = base_url or storage.get_config("model_base_url") or DEEPSEEK_BASE_URL
    model = model or storage.get_config("model_name") or DEEPSEEK_MODEL
    try:
        resp = httpx.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key.strip()}",
                     "Content-Type": "application/json"},
            json={
                "model": model,
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
          json_mode: bool = True, base_url: str = None, model: str = None) -> Optional[str]:
    """调用模型 chat；失败返回 None 交由上层 fallback。

    base_url / model 缺省时回退到已保存配置再回退硬编码默认值，
    使后台「配置模型」页设置的模型真正生效（gen_* 调用无需逐个改签名）。
    """
    if not api_key:
        return None
    base_url = base_url or storage.get_config("model_base_url") or DEEPSEEK_BASE_URL
    model = model or storage.get_config("model_name") or DEEPSEEK_MODEL
    payload = {
        "model": model,
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
            f"{base_url}/chat/completions",
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
def gen_problem(api_key: str, seq: int, language: str = "python") -> dict:
    slug, title, difficulty = fb.FALLBACK_TITLES[(seq - 1) % len(fb.FALLBACK_TITLES)]
    system = (
        "你是资深的力扣出题官。请输出一道经典力扣题目的规范中文题面，"
        "只返回 JSON，字段：statement(题目描述), examples(数组，每项含 input/output/explanation), "
        "constraints(约束数组)。语言简洁、准确。"
    )
    user = (
        f"请给出力扣题《{title}》(编号顺序第{seq}题, 难度{difficulty})的完整规范题面。"
        f"如果涉及示例代码片段，请用 {language} 编写。"
    )
    data = _parse_json(_chat(api_key, system, user, temperature=0.3))
    if data and data.get("statement"):
        return {"slug": slug, "title": title, "difficulty": difficulty,
                "statement": data.get("statement"),
                "examples": data.get("examples", []),
                "constraints": data.get("constraints", [])}
    raise AgentError(
        "出题失败：模型未返回有效题面。请确认已在设置中配置有效的模型 Key，"
        "且当前网络可访问该模型服务。"
    )


# ---------------------------------------------------------------- 讲解 Agent
def gen_explanation(api_key: str, problem: dict, language: str = "python") -> str:
    """生成通俗讲解，返回纯文本字符串（不使用 markdown 标记）。

    关键：把当前题目的标题/难度/题面/示例/约束作为结构化变量注入 prompt，
    并显式约束「只能基于本题目讲解、严禁套用其它题（尤其两数之和）」，
    避免模型退化成讲解通用模板。
    """
    system = (
        "你是最会讲题的小蜜蜂 lico。请用通俗易懂、形象生动、像讲故事一样的语言，"
        "讲解【下面题目】字段里给出的这道算法题的解题思路。\n"
        "硬性要求：\n"
        "1. 必须且只能基于下方【题目】提供的内容讲解，严禁套用其它题"
        "（尤其严禁默认成\"两数之和\"或其它通用模板）。\n"
        "2. 每一段都要有生活化比喻（手算、排队、流水、收纳、走路、地图、做菜等任选）。\n"
        "3. 语言口语化，不要教科书腔。\n"
        "4. 把讲解分成若干小段，每段 3-5 行，段与段之间用一个空行分隔；只使用自然段落，\n"
        "   不要使用 markdown 标题（#）、列表符号（-、*）或粗体（**）等标记。\n"
        "5. 只返回讲解正文纯文本，不要使用任何 markdown 格式标记（不要 #、**、` 等符号），"
        "也不要用 JSON 包裹。"
    )
    content = problem.get("content") or {}
    user = (
        f"【题目】\n"
        f"标题：{problem.get('title', '')}\n"
        f"难度：{problem.get('difficulty', '')}\n"
        f"题面：{content.get('statement', '')}\n"
        f"示例：{content.get('examples', [])}\n"
        f"约束：{content.get('constraints', [])}\n\n"
        "请只针对上面这一道题，讲解它的解题思路"
        "（不要讲成通用模板，更不要讲成两数之和）。"
    )
    data = _chat(api_key, system, user, temperature=0.7, json_mode=False)
    if data and data.strip():
        return data.strip()
    raise AgentError(
        "讲解生成失败：模型未返回有效内容。请确认已在设置中配置有效的模型 Key，"
        "且当前网络可访问该模型服务。"
    )


# ---------------------------------------------------------------- 分解 Agent
def gen_steps(api_key: str, problem: dict, explanation: str = "", language: str = "python") -> list:
    expl_hint = explanation.strip() if explanation else "（暂无前置讲解文本，请直接按题面拆解）"
    system = (
        "你擅长把算法代码按难度拆解成循序渐进的步骤。下面先给你一段已经讲给学员的通俗讲解，"
        "请基于它来做代码分解——保证「讲解里说的思路」和「代码实际写的」完全一致，"
        "不要出现讲解提了但代码没体现、或代码有但讲解没说的脱节。\n"
        "拆分规则：\n"
        "1. 步骤数量由你根据解法复杂度自行决定，必须在 3~5 步之间（含 3 和 5）。\n"
        "2. 每一步的「代码量」尽量平均（行数、逻辑量大致相当），不要某一步特别长、另一步仅一行；"
        "在平均的前提下，必须保证这一步的内容被完整讲清楚、代码在该步状态下完整可运行。\n"
        f"3. 只返回 JSON，字段 steps(数组)。每个 step 含："
        f"index(从0开始的序号), title(简短标题), "
        f"explanation(这一步在做什么，口语化，呼应前面讲解里的比喻), "
        f"incremental_code(【本步新增】的 {language} 代码，只写这一步新加的部分，"
        f"不要重复之前步骤已有的代码；逐行都要有中文注释解释为什么这么写)。\n"
        "4. 第 0 步的 incremental_code 就是完整函数开头；后续每一步只写在上一步基础上新追加的行。"
        "最后一步应是让整段代码成为完整可运行解法的那次追加。\n"
        "5. 各步 incremental_code 按顺序首尾相接，必须恰好等于完整解法代码；"
        "除非空行本身属于代码逻辑，否则不要在步骤之间插入额外空行。"
    )
    user = (
        f"【前面已讲给学员的通俗讲解】\n{expl_hint}\n\n"
        f"【题目】\n题目：{problem['title']}\n"
        f"描述：{problem['content'].get('statement','')}\n\n"
        "请基于上面的讲解给出分步手撕方案，每步只给增量代码；"
        "步数你自己定（3~5步），各步代码量尽量平均，且完整覆盖解法。"
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
    raise AgentError(
        "步骤分解失败：模型未返回有效分步。请确认已配置有效的模型 Key 且网络可访问。"
    )


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
                is_final: bool, language: str = "python") -> dict:
    reference = ""
    if is_final and problem.get("steps"):
        reference = problem["steps"][-1].get("code", "")
    elif step:
        reference = step.get("code", "")

    system = (
        f"你是严格但温暖的代码审查员小蜜蜂 lico。代码语言：{language}。"
        f"审查用户手敲的代码。"
        f"只返回 JSON，字段：severity(none=完全正确/minor=有小问题但思路对/major=错误较大), "
        f"feedback(中文反馈，指出对错与原因), hint(若需重敲，给一句提示)。"
        f"评判标准：思路正确、关键逻辑到位即可判 none 或 minor；"
        f"只有逻辑缺失、方向错误、无法运行才判 major。"
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
    raise AgentError(
        "代码审查失败：模型未返回有效结论。请确认已配置有效的模型 Key 且网络可访问。"
    )


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
