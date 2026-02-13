@echo off
setlocal

REM Install dependencies and start backend (nodemon)
start "chat-bot-backend" cmd /k "cd /d %~dp0 && npm run dev"

REM Install dependencies and start frontend
start "chat-bot-frontend" cmd /k "cd /d %~dp0client && npm run dev"

REM Open frontend in default browser after a short delay
ping 127.0.0.1 -n 4 > nul
start "" http://localhost:5173

endlocal
