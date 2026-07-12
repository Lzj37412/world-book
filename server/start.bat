@echo off
cd /d "%~dp0\.."
echo 启动记忆沙盒服务器...
node server/index.js
pause
