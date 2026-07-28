@echo off
setlocal enabledelayedexpansion

set "LOG=%~dp0start.log"
echo [%date% %time%] Lico launcher started > "%LOG%"

REM 1) Find a Python that already has fastapi/uvicorn installed (prefer local ones, skip venv)
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

REM 2) Fallback: build a venv if no Python has the deps (needs internet)
if not defined PY (
  echo No Python with deps found, creating venv (needs internet)... >> "%LOG%"
  where python >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ and check "Add to PATH". >> "%LOG%"
    echo [ERROR] Python not found. Install Python 3.10+ and check "Add to PATH".
    pause
    exit /b 1
  )
  pushd "%~dp0backend"
  python -m venv venv >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] venv creation failed. >> "%LOG%"
    echo [ERROR] venv creation failed.
    pause
    exit /b 1
  )
  venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] pip install failed. Check your network. >> "%LOG%"
    echo [ERROR] pip install failed. Check your network.
    pause
    exit /b 1
  )
  popd
  set "PY=%~dp0backend\venv\Scripts\python.exe"
)

echo Using Python: %PY% >> "%LOG%"

REM 3) Start backend in its own minimized window.
REM    Do NOT wrap in cmd /c "..." (nested quotes break the python path on Windows).
REM    Use uvicorn's own --log-file so crashes are captured even if the window closes.
pushd "%~dp0backend"
start "Lico backend" /MIN "%PY%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-file "%~dp0backend\uvicorn.log"
popd

REM 4) Wait up to 30s for the service
echo.
echo ============================================================
echo   Lico is starting...
echo ============================================================
echo Waiting for service...
set /a waited=0
:wait_loop
curl -s http://127.0.0.1:8000/api/status >nul 2>nul
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  set /a waited+=1
  if !waited! geq 30 (
    echo [ERROR] Service startup timed out. Check the "Lico backend" window or uvicorn.log. >> "%LOG%"
    echo [ERROR] Service startup timed out. Check the "Lico backend" window or uvicorn.log.
    echo Details in: %LOG%
    pause
    exit /b 1
  )
  goto wait_loop
)

REM 5) Open browser
echo.
echo ============================================================
echo   Lico is ready! Browser: http://127.0.0.1:8000
echo ============================================================
echo [%date% %time%] Service ready, opening browser >> "%LOG%"
start "" http://127.0.0.1:8000

pause
