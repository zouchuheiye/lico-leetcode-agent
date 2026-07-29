@echo off
set "SCRIPT=%~dp0run.py"
if exist "D:\miniconda3\python.exe" (
  "D:\miniconda3\python.exe" "%SCRIPT%"
) else (
  py "%SCRIPT%" 2>nul || python "%SCRIPT%"
)
