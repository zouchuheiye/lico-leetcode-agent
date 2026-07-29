"""全局配置：DeepSeek-V4 接入信息与路径。

Key 由用户在前端配置后写入本地存储层（config 表），
后端启动时不需要预置 Key。
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "lico.db")
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend"))

# DeepSeek OpenAI 兼容接口
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
# 用户要求仅支持 deepseek-v4；DeepSeek 线上对应的模型标识为 deepseek-chat
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_MODEL_LABEL = "DeepSeek-V4"

# 服务商预设：前端选择后自动预填 Base URL 与默认模型名
PROVIDER_PRESETS = {
    "deepseek": {"label": "DeepSeek", "base_url": "https://api.deepseek.com", "model": "deepseek-chat"},
    "openai":   {"label": "OpenAI", "base_url": "https://api.openai.com/v1", "model": "gpt-4o"},
    "custom":   {"label": "自定义（OpenAI 兼容）", "base_url": "", "model": ""},
}

# 一趟学习之旅的总题量
TOTAL_PROBLEMS = 100

# 请求超时（秒）
REQUEST_TIMEOUT = 60
