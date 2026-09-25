@echo off
setlocal
cd /d "%~dp0"
title RAGORA Setup
echo ============================================
echo         RAGORA - Windows Setup Script
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.10+ from https://python.org first.
    pause
    exit /b 1
)

echo [1/5] Creating virtual environment...
python -m venv venv

echo [2/5] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/5] Upgrading pip...
python -m pip install --upgrade pip >nul

echo [4/5] Installing requirements...
pip install -r requirements.txt

if not exist ".env" (
    echo [5/5] Creating .env from template...
    copy .env.example .env >nul
    echo.
    echo   >>> IMPORTANT: Open .env and add your Google and Groq API keys. <<<
    echo.
) else (
    echo [5/5] .env already exists, skipping.
)

echo Running Python compile check on all files...
python -m py_compile app.py db.py config.py auth.py rag_engine.py
if %errorlevel% neq 0 (
    echo [ERROR] Compile check failed. See errors above.
    pause
    exit /b 1
)
echo Compile check passed.

echo.
echo ============================================
echo  Setup complete! Starting RAGORA server...
echo  Open http://localhost:5000 in your browser
echo ============================================
python app.py

pause
