@echo off
title QuestSync
cd /d "%~dp0"
echo Starting QuestSync...
set "ELECTRON_RUN_AS_NODE="
npm start
if %ERRORLEVEL% NEQ 0 (
  echo.
  pause
)

