@echo off
chcp 65001 >nul 2>nul
REM ============================================================
REM  Lico 力扣手撕辅导 Agent —— 启动器（Windows 通用版）
REM  双击本文件即可，无需懂技术。
REM  详细说明见同目录 README.md
REM ============================================================
setlocal enabledelayedexpansion

set "LOG=%~dp0start.log"
echo [%date% %time%] Lico 启动器开始运行 > "%LOG%"

REM 1) 找一个【已经装好 fastapi/uvicorn 依赖】的 Python，优先本机已装好的，
REM    避免每次双击都联网建 venv（这正是之前“连接错误”的根因）。
set "PY="
for %%P in (
  "D:\miniconda3\python.exe"
  "C:\Users\14481\AppData\Local\Programs\Python\Python311\python.exe"
  "python"
) do (
  if not defined PY (
    "%%~P" -c "import fastapi, uvicorn" >nul 2>nul
    if not errorlevel 1 (
      set "PY=%%~P"
    )
  )
)

REM 2) 若没有任何现成 Python 带依赖，再回退到建 venv（需要联网）。
if not defined PY (
  echo 未找到已安装依赖的 Python，尝试创建运行环境（需联网）... >> "%LOG%"
  where python >nul 2>nul
  if errorlevel 1 (
    echo [错误] 没有找到 Python。请先从 https://www.python.org/downloads/ 安装 Python 3.10+，>> "%LOG%"
    echo [错误] 没有找到 Python。请先从 https://www.python.org/downloads/ 安装 Python 3.10+，
    echo         安装时务必勾选 "Add python.exe to PATH"。
    pause
    exit /b 1
  )
  pushd "%~dp0backend"
  python -m venv venv >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [错误] 创建运行环境失败，请重新安装 Python 并勾选 "Add to PATH"。>> "%LOG%"
    echo [错误] 创建运行环境失败，请重新安装 Python 并勾选 "Add to PATH"。
    pause
    exit /b 1
  )
  venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [错误] 安装依赖失败，请检查网络后重试。>> "%LOG%"
    echo [错误] 安装依赖失败，请检查网络后重试。
    pause
    exit /b 1
  )
  popd
  set "PY=%~dp0backend\venv\Scripts\python.exe"
)

echo 使用 Python: %PY% >> "%LOG%"

REM 3) 启动后台服务（独立最小化窗口，关闭该窗口即停止）
pushd "%~dp0backend"
start "Lico 后台服务" /MIN cmd /c ""%PY%" -m uvicorn main:app --host 127.0.0.1 --port 8000"
popd

REM 4) 等待服务真正就绪，最多等 30 秒
echo.
echo ============================================================
echo   Lico 正在启动...
echo ============================================================
echo 正在等待服务就绪...
set /a waited=0
:wait_loop
curl -s http://127.0.0.1:8000/api/status >nul 2>nul
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  set /a waited+=1
  if !waited! geq 30 (
    echo [错误] 服务启动超时，请查看名为 "Lico 后台服务" 的黑色窗口。>> "%LOG%"
    echo [错误] 服务启动超时，请查看名为 "Lico 后台服务" 的黑色窗口。
    echo 详细信息已写入：%LOG%
    pause
    exit /b 1
  )
  goto wait_loop
)

REM 5) 服务已就绪，打开浏览器
echo.
echo ============================================================
echo   Lico 已启动！
echo   浏览器会自动打开：http://127.0.0.1:8000
echo ============================================================
echo [%date% %time%] 服务已就绪，正在打开浏览器 >> "%LOG%"
start "" http://127.0.0.1:8000

pause
