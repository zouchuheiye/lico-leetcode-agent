"""存储层：所有学习轨迹永久保存。

设计目标（对应需求）：
- 题目一旦由出题 Agent 生成即缓存，再次学习直接读取，不重复生成。
- 讲解、分解步骤、听/读事件、每一次敲代码、每一次审查结果，
  都原封不动落库；复习时看到的就是当初学习的完整轨迹。
- 已做题集：按题目读取其全部学习过程。
"""
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Optional

from config import DB_PATH, TOTAL_PROBLEMS


def _now() -> float:
    return time.time()


def _cleanup_stale_journal() -> None:
    """清理上一次被强制结束（Stop-Process -Force）遗留的 sqlite 临时文件。

    这些残留的 -journal / -wal / -shm 会让下一次连接的首次写入报
    'unable to open database file'。init_db 在启动时调用，此时没有其它
    进程持锁，可安全删除（被强杀进程的事务本就已丢失）。
    """
    for suffix in ("-journal", "-wal", "-shm"):
        tmp = DB_PATH + suffix
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
                print(f"[storage] 已清理异常退出遗留的临时文件: {tmp}", flush=True)
        except OSError as e:
            print(f"[storage] 清理临时文件失败 {tmp}: {e}", flush=True)


@contextmanager
def get_conn():
    # timeout=30：被强制结束的进程残留的锁会随进程消亡而释放，但 Windows 文件锁
    #   可能短暂残留，等待即可，避免 'database is locked' / 'unable to open' 直接失败
    # check_same_thread=False：FastAPI 同步路由在线程池执行，每个请求独立建连，安全
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.execute("PRAGMA busy_timeout=30000")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    _cleanup_stale_journal()
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS config (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
            """
        )
        # 题目：内容 / 讲解 / 分解步骤 均缓存于此，生成一次永久复用
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS problems (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                seq          INTEGER UNIQUE,           -- 学习顺序 1..100
                slug         TEXT,
                title        TEXT,
                difficulty   TEXT,
                content_json TEXT,                      -- 题面/示例/约束
                explanation_json TEXT,                  -- 讲解 + 金句哲学 + 例子
                steps_json   TEXT,                       -- 分解后的分步代码与逐行注释
                status       TEXT DEFAULT 'learning',    -- learning / done
                created_at   REAL,
                done_at      REAL
            )
            """
        )
        # 学习轨迹事件：听题、朗读、进入步骤、遮挡讲解等，原封不动记录
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                problem_id  INTEGER,
                step_index  INTEGER,                     -- -1 表示题目级
                type        TEXT,
                payload_json TEXT,
                created_at  REAL
            )
            """
        )
        # 代码提交与审查：每一次敲的代码、审查结论都保存
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                problem_id  INTEGER,
                step_index  INTEGER,                     -- -1 表示最终整题作答
                code        TEXT,
                severity    TEXT,                        -- none / minor / major
                passed      INTEGER,                     -- 是否允许进入下一步
                review_json TEXT,
                created_at  REAL
            )
            """
        )
        # 断点续学：记录每题进行到的阶段与步骤，下次从中断处继续
        try:
            c.execute("ALTER TABLE problems ADD COLUMN checkpoint_json TEXT")
        except Exception:
            pass  # 列已存在则忽略
        conn.commit()


# ---------------------------------------------------------------- config
def set_config(key: str, value: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO config(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )


def get_config(key: str) -> Optional[str]:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM config WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None


# ---------------------------------------------------------------- problems
def _row_to_problem(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "seq": row["seq"],
        "slug": row["slug"],
        "title": row["title"],
        "difficulty": row["difficulty"],
        "content": json.loads(row["content_json"]) if row["content_json"] else None,
        "explanation": json.loads(row["explanation_json"]) if row["explanation_json"] else None,
        "steps": json.loads(row["steps_json"]) if row["steps_json"] else None,
        "status": row["status"],
        "checkpoint": json.loads(row["checkpoint_json"]) if row["checkpoint_json"] else None,
        "created_at": row["created_at"],
        "done_at": row["done_at"],
    }


def get_problem_by_seq(seq: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM problems WHERE seq=?", (seq,)).fetchone()
        return _row_to_problem(row) if row else None


def get_problem(problem_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM problems WHERE id=?", (problem_id,)).fetchone()
        return _row_to_problem(row) if row else None


def create_problem(seq: int, slug: str, title: str, difficulty: str, content: dict) -> dict:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO problems(seq, slug, title, difficulty, content_json, status, created_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (seq, slug, title, difficulty, json.dumps(content, ensure_ascii=False), "learning", _now()),
        )
    return get_problem_by_seq(seq)


def save_explanation(problem_id: int, explanation: dict) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE problems SET explanation_json=? WHERE id=?",
            (json.dumps(explanation, ensure_ascii=False), problem_id),
        )


def save_steps(problem_id: int, steps: list) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE problems SET steps_json=? WHERE id=?",
            (json.dumps(steps, ensure_ascii=False), problem_id),
        )


def mark_done(problem_id: int) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE problems SET status='done', done_at=?, checkpoint_json=NULL WHERE id=?",
            (_now(), problem_id),
        )


def get_current_problem() -> Optional[dict]:
    """返回当前正在进行（未学完）的题目，用于断点续学。"""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM problems WHERE status='learning' ORDER BY created_at DESC, id DESC LIMIT 1"
        ).fetchone()
        return _row_to_problem(row) if row else None


def save_checkpoint(problem_id: int, phase: str, step_index: int) -> None:
    """记录该题目进行到的阶段与步骤，下次从中断处继续。"""
    with get_conn() as conn:
        conn.execute(
            "UPDATE problems SET checkpoint_json=? WHERE id=?",
            (json.dumps({"phase": phase, "step_index": step_index}, ensure_ascii=False), problem_id),
        )


def list_problems() -> list:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM problems ORDER BY seq ASC").fetchall()
        return [_row_to_problem(r) for r in rows]


def count_done() -> int:
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM problems WHERE status='done'").fetchone()
        return row["n"]


def next_seq_to_learn() -> int:
    """返回下一个待学习的顺序号。"""
    with get_conn() as conn:
        row = conn.execute("SELECT MAX(seq) AS m FROM problems").fetchone()
        return (row["m"] or 0) + 1


# ---------------------------------------------------------------- events
def add_event(problem_id: int, step_index: int, etype: str, payload: Any = None) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO events(problem_id, step_index, type, payload_json, created_at) VALUES(?,?,?,?,?)",
            (problem_id, step_index, etype, json.dumps(payload, ensure_ascii=False), _now()),
        )


def get_events(problem_id: int) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM events WHERE problem_id=? ORDER BY created_at ASC, id ASC",
            (problem_id,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "step_index": r["step_index"],
                "type": r["type"],
                "payload": json.loads(r["payload_json"]) if r["payload_json"] else None,
                "created_at": r["created_at"],
            }
            for r in rows
        ]


# ---------------------------------------------------------------- submissions
def add_submission(problem_id: int, step_index: int, code: str, review: dict) -> dict:
    severity = review.get("severity", "none")
    passed = 1 if severity in ("none", "minor") else 0
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO submissions(problem_id, step_index, code, severity, passed, review_json, created_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (problem_id, step_index, code, severity, passed, json.dumps(review, ensure_ascii=False), _now()),
        )
        sub_id = cur.lastrowid
    return {"id": sub_id, "severity": severity, "passed": bool(passed), "review": review}


def get_submissions(problem_id: int) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM submissions WHERE problem_id=? ORDER BY created_at ASC, id ASC",
            (problem_id,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "step_index": r["step_index"],
                "code": r["code"],
                "severity": r["severity"],
                "passed": bool(r["passed"]),
                "review": json.loads(r["review_json"]) if r["review_json"] else None,
                "created_at": r["created_at"],
            }
            for r in rows
        ]


def get_full_trajectory(problem_id: int) -> dict:
    """复习时读取：题目 + 讲解 + 步骤 + 全部事件 + 全部提交审查。"""
    problem = get_problem(problem_id)
    if not problem:
        return None
    return {
        "problem": problem,
        "events": get_events(problem_id),
        "submissions": get_submissions(problem_id),
    }
