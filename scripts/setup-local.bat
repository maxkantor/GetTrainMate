@echo off
REM Windows setup script for GetTrainMate

echo.
echo 🏗️  GetTrainMate Local Setup
echo.

REM Check prerequisites
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed
    exit /b 1
)

where dotnet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ .NET 10 SDK is not installed
    exit /b 1
)

echo ✅ Prerequisites OK
echo.

REM Install root dependencies
echo 📦 Installing root dependencies...
call npm install
echo.

REM Setup environment
if not exist .env.local (
    echo 📄 Creating .env.local from template...
    copy .env.example .env.local
    echo ⚠️  Update .env.local with your AWS credentials and Cognito details
)
echo.

echo ✅ Setup complete!
echo.
echo Next steps:
echo   1. Edit .env.local with your configuration
echo   2. Run 'npm run web:dev' to start the frontend
echo   3. Run 'cd apps\api ^&^& dotnet run' to start the backend
echo   4. Run 'npm run infra:synth' to preview CDK deployment
echo.
