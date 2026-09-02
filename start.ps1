# PAN - one-shot startup: opencode agent + backend + web, then print every
# reachable URL (localhost + all LAN IPs) for desktop and mobile access.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$logDir = Join-Path $env:TEMP "opencode"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Port([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Stop-Port([int]$Port, [string]$Name) {
  # uvicorn --reload spawns a worker that inherits the listen socket; the TCP
  # table keeps attributing the port to the (dead) reloader PID, so kill by
  # command line instead of trusting the port owner PID (backend only).
  if ($Port -eq 8000) {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match "uvicorn|spawn_main" -and $_.Name -notmatch "powershell|cmd" } |
      ForEach-Object {
        Write-Host "  restarting $Name (stopping PID $($_.ProcessId) on :$Port)" -ForegroundColor DarkGray
        cmd /c "taskkill /F /T /PID $($_.ProcessId) 2>nul" | Out-Null
      }
  }
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    if ((Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue)) {
      Write-Host "  restarting $Name (stopping PID $($c.OwningProcess) on :$Port)" -ForegroundColor DarkGray
      cmd /c "taskkill /F /T /PID $($c.OwningProcess) 2>nul" | Out-Null
    }
  }
  Start-Sleep -Seconds 2
}

function Wait-Healthy([string]$Url, [string]$Label, [int]$Seconds = 120) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -lt 500) { Write-Host "  $Label ok" -ForegroundColor Green; return }
    } catch { Start-Sleep -Seconds 2 }
  }
  Write-Host "  $Label FAILED after $Seconds s (check $logDir)" -ForegroundColor Red
}

Write-Host ""
Write-Host "================ PAN startup ================" -ForegroundColor Cyan

$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -ExpandProperty IPAddress)
if (-not $ips) { $ips = @("localhost") }

# --- 1. opencode agent server (deepseek-v4-flash) ---
Write-Host "[1/4] opencode agent (127.0.0.1:4096)" -ForegroundColor Cyan
if (-not (Test-Port 4096)) {
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c set OPENCODE_MODEL=opencode-go/deepseek-v4-flash && opencode serve --port 4096 > `"$logDir\opencode-serve.log`" 2>&1" `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 5
}
if (Test-Port 4096) { Write-Host "  opencode ok" -ForegroundColor Green }
else { Write-Host "  opencode FAILED (see $logDir\opencode-serve.log)" -ForegroundColor Red }

# --- 2. backend API (bind 0.0.0.0 so phones on the LAN can reach it) ---
Write-Host "[2/4] PAN backend (0.0.0.0:8000)" -ForegroundColor Cyan
Stop-Port 8000 "backend"
$p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > `"$logDir\backend.log`" 2>&1" `
  -WorkingDirectory (Join-Path $root "backend") -WindowStyle Hidden -PassThru
Wait-Healthy "http://127.0.0.1:8000/api/health" "backend"

# --- 3. Telegram bot (standalone mobile companion app) ---
Write-Host "[3/4] Telegram bot (mobile companion)" -ForegroundColor Cyan
$envFile = Join-Path $root "backend\.env"
$match = Select-String -Path $envFile -Pattern "^TELEGRAM_BOT_TOKEN=(.+)" -ErrorAction SilentlyContinue
$botToken = if ($match) { $match.Matches.Groups[1].Value.Trim() } else { "" }
if ($botToken) {
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c .\.venv\Scripts\python.exe -m app.services.telegram_bot > `"$logDir\telegram-bot.log`" 2>&1" `
    -WorkingDirectory (Join-Path $root "backend") -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 4
  if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) { Write-Host "  telegram bot ok" -ForegroundColor Green }
  else { Write-Host "  telegram bot FAILED (see $logDir\telegram-bot.log)" -ForegroundColor Red }
} else {
  Write-Host "  skipped - TELEGRAM_BOT_TOKEN is empty in backend\.env (set it to enable)" -ForegroundColor DarkGray
}

# --- 4. web frontend ---
Write-Host "[4/5] PAN web (0.0.0.0:3000)" -ForegroundColor Cyan
Stop-Port 3000 "frontend"
$p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > `"$logDir\frontend-dev.log`" 2>&1" `
  -WorkingDirectory (Join-Path $root "frontend") -WindowStyle Hidden -PassThru
Wait-Healthy "http://127.0.0.1:3000/login" "frontend" 180

# --- 5. real mobile app (standalone PWA, node server on :4000, :4443 TLS) ---
Write-Host "[5/5] Vulnexa mobile app (0.0.0.0:4000)" -ForegroundColor Cyan
Stop-Port 4000 "mobile app"
$p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c node server.js > `"$logDir\mobile-app.log`" 2>&1" `
  -WorkingDirectory (Join-Path $root "mobile-app") -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3
if (Test-Port 4000) { Write-Host "  mobile app ok" -ForegroundColor Green }
else { Write-Host "  mobile app FAILED (see $logDir\mobile-app.log)" -ForegroundColor Red }

# --- summary: every IP x every service ---
Write-Host ""
Write-Host "================ PAN is up ================" -ForegroundColor Cyan
foreach ($ip in $ips) {
  Write-Host ""
  Write-Host "  $ip" -ForegroundColor Yellow
  Write-Host "    Web UI    http://$ip`:3000          (login / home / bug-hunter)" -ForegroundColor White
  Write-Host "    Mobile    http://$ip`:4000          (Vulnexa Live - standalone mobile app)" -ForegroundColor White
  Write-Host "    API docs  http://$ip`:8000/api/docs" -ForegroundColor White
  Write-Host "    Mobile API http://$ip`:8000/api/mobile  (chat + data, MOBILE_TOKEN protected)" -ForegroundColor White
}
Write-Host ""
Write-Host "  Agent     http://127.0.0.1:4096  (opencode - opencode-go/deepseek-v4-flash)" -ForegroundColor White
if ($botToken) { Write-Host "  Telegram  bot running (chat with the bot on your phone)" -ForegroundColor White }
Write-Host "  Login     admin@pan.local / PanAdmin!2026   (dev-only)" -ForegroundColor DarkGray
Write-Host "  Logs      $logDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Note: for phone access, allow inbound on TCP 3000 + 8000 in Windows Firewall." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan