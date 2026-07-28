@echo off
chcp 65001 >nul 2>nul
REM ============================================================
REM  Lico 力扣手撕辅导 Agent —— 启动器（Windows 通用版）
REM  给使用者：双击本文件即可，无需懂技术。
REM  详细说明见同目录 README.md
REM ============================================================
setlocal enabledelayedexpansion

cd /d "%~dp0backend"
set "LOG=%~dp0start.log"
echo [%date% %time%] Lico 启动器开始运行 > "%LOG%"

REM 1) 检测本机是否安装了 Python 3.10+
where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Python。>> "%LOG%"
  echo [错误] 没有找到 Python。
  echo         请先从 https://www.python.org/downloads/ 安装 Python 3.10+，
  echo         安装时务必勾选 "Add python.exe to PATH"。
  echo.
  echo 详细信息已写入：%LOG%
  pause
  exit /b 1
)

REM 2) 首次运行自动创建隔离的虚拟环境（不影响你电脑其他 Python 项目）
if not exist "venv\Scripts\python.exe" (
  echo 正在创建运行环境（首次稍慢，之后会很快）...
  python -m venv venv >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [错误] 创建运行环境失败。>> "%LOG%"
    echo [错误] 创建运行环境失败。
    echo         可能是 Python 安装不完整，请重新安装并勾选 "Add to PATH"。
    echo 详细信息已写入：%LOG%
    pause
    exit /b 1
  )
)

REM 3) 安装/更新依赖
echo 正在准备依赖（首次需要联网下载，请稍等）...
venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [错误] 安装依赖失败。>> "%LOG%"
  echo [错误] 安装依赖失败。
  echo         请检查网络连接，或手动运行：
  echo         cd backend ^&^& venv\Scripts\python.exe -m pip install -r requirements.txt
  echo 详细信息已写入：%LOG%
  pause
  exit /b 1
)

REM 4) 启动服务
echo.
echo ============================================================
echo   Lico 正在启动...
echo ============================================================
echo 启动后台服务... >> "%LOG%"

REM 用 start 把 uvicorn 放到独立的 CMD 窗口运行，这样启动器窗口可以继续检测
REM 用 pushd 切换到 backend 再启动（避免 cd /d 与 start 的引号嵌套被 cmd 解析坏）
pushd "%~dp0backend"
start "Lico 后台服务" /MIN cmd /c "venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
popd

REM 5) 等待服务真正就绪，最多等 30 秒
echo 正在等待服务就绪...
set /a waited=0
:wait_loop
curl -s http://127.0.0.1:8000/api/status >nul 2>nul
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  set /a waited+=1
  if !waited! geq 30 (
    echo [错误] 服务启动超时。>> "%LOG%"
    echo [错误] 服务启动超时，请查看名为 "Lico 后台服务" 的黑色窗口。
    echo 详细信息已写入：%LOG%
    pause
    exit /b 1
  )
  goto wait_loop
)

REM 6) 服务已就绪，打开浏览器
echo.
echo ============================================================
echo   Lico 已启动！
echo   浏览器会自动打开：http://127.0.0.1:8000
REM echo   首次使用请按提示填入你自己的 DeepSeek Key
REM echo   关闭名为 "Lico 后台服务" 的黑色窗口即停止程序
echo ============================================================
echo [%date% %time%] 服务已就绪，正在打开浏览器 >> "%LOG%"
start "" http://127.0.0.1:8000

pause
