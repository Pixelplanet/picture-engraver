@echo off
title Picture Engraver Deployment
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "deploy-scripts\deploy_interactive.ps1"
pause
