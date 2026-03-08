@echo off
REM Start both backend and frontend for Dreamweaver app
cd /d %~dp0


REM Start backend (Node.js, with nodemon for auto-reload) from project root so .env is loaded
start "Dreamweaver Backend" cmd /k "cd /d %~dp0 && npx nodemon src/index.js"

REM Start frontend (Vite dev server)
cd client
start "Dreamweaver Frontend" cmd /k "npm run dev -- --host"

REM Return to root
cd ..
