# Lico 力扣手撕辅导 Agent

一只上发条的木偶蜜蜂 🐝「lico」，陪你手撕力扣算法。  
配置 Key → 听题/朗读 → 形象讲解+金句 → 分步敲代码+审查 → 整题默写 → 全程轨迹留存。

## 给使用者（老板/同事）的快速说明

**需要：** 一台 Windows 电脑 + 已安装 Python 3.10 及以上（安装时勾选 “Add python.exe to PATH”）。  
**不需要：** 任何编程知识、服务器、账号。

### 三步开始
1. 把整个 `lico_v2` 文件夹拷到任意位置（桌面也行）。
2. **双击 `start.bat`**。首次会自动装好运行环境（几十秒），之后秒开。
3. 浏览器自动打开 `http://127.0.0.1:8000`。按提示填入你**自己的** DeepSeek Key，点击「上发条」即可开始。

> ⚠️ 关于 Key：Key 只保存在你本机数据库里，**不会上传给任何人**。本项目源码中不含任何 Key。

### 不填 Key 也能看效果
即使不填 Key，也能用内置离线题库跑通完整流程（第 1 题「两数之和」为完整离线内容），适合先看演示。

## 目录结构
```
lico_v2/
├─ start.bat            # Windows 一键启动器（双击即可）
├─ README.md            # 本说明
├─ backend/             # Python 后端（FastAPI + SQLite 存储 + 四个 AI Agent）
│  ├─ main.py           # 接口与路由
│  ├─ storage.py        # 永久存储层（所有学习轨迹）
│  ├─ agents.py         # 出题/讲解/分解/审查四个 Agent
│  ├─ fallback_problems.py # 离线兜底题库
│  ├─ config.py         # 模型/路径配置
│  └─ requirements.txt  # Python 依赖
└─ frontend/            # 原生前端（HTML/CSS/JS，蜜蜂动画+语音+发条）
   ├─ index.html
   ├─ css/style.css
   └─ js/  (api.js / bee.js / app.js)
```

## 常见问题
- **端口 8000 被占用**：关掉占用 8000 的程序，或改 `start.bat` 最后一行 `--port 8000` 为其他端口。
- **想换模型标识**：编辑 `backend/config.py` 里的 `DEEPSEEK_MODEL`。
- **数据在哪**：所有学习记录存在 `backend/lico.db`（SQLite）。删掉它即回到初始状态。
- **听题没声音**：Windows 设置 → 时间和语言 → 语音 → 添加中文（简体）语音包，重启浏览器即可。

## 技术备注（给技术同学）
- 前后端分离：FastAPI 提供 REST 接口并托管前端静态文件。
- 存储层永久保存所有学习轨迹（讲解、分解、每步代码、每次审查结论），复习可看原始过程。
- 断点续学：中断后下次进入从该题中断处继续；只有整题通过才标记「已学完」。
