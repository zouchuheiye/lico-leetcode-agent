@echo off
REM ============================================================
REM  Lico 力扣手撕辅导 Agent —— 启动器（Windows 通用版）
REM  给使用者：双击本文件即可，无需懂技术。
REM  详细说明见同目录 README.md
REM ============================================================
cd /d "%~dp0backend"

REM 1) 检测本机是否安装了 Python 3.10+
where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Python。请先从 https://www.python.org/downloads/ 安装
  echo         Python 3.10 或更高版本，并务必勾选 "Add python.exe to PATH"。
  pause
  exit /b 1
)

REM 2) 首次运行自动创建隔离的虚拟环境（不影响你电脑其他 Python 项目）
if not exist "venv\Scripts\python.exe" (
  echo 正在创建运行环境（首次稍慢，之后会很快）...
  python -m venv venv
)

REM 3) 安装/更新依赖
echo 正在准备依赖...
venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt

REM 4) 启动并打开浏览器
echo.
echo ============================================================
echo   Lico 已启动！
echo   浏览器会自动打开：http://127.0.0.1:8000
echo   首次使用请按提示填入你自己的 DeepSeek Key
echo   关闭此窗口即停止程序
echo ============================================================
start "" http://127.0.0.1:8000
venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
