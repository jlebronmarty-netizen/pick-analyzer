param(
  [int]$Port = 3047,
  [string[]]$Routes = @('/api/system/version', '/dashboard', '/probability-picks', '/performance', '/player-projections', '/api/current-board', '/ai-operations'),
  [int]$RouteTimeoutSeconds = 12,
  [int]$TotalTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$baseUrl = "http://127.0.0.1:$Port"
$Routes = @($Routes | ForEach-Object { "$_".Split(',', [System.StringSplitOptions]::RemoveEmptyEntries) } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$startedAt = Get-Date
$deadline = $startedAt.AddSeconds($TotalTimeoutSeconds)
$server = $null
$watchdog = $null
$results = New-Object System.Collections.Generic.List[object]
$outFile = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port.out.log"
$errFile = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port.err.log"
$markerFile = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port.running"
$serverPidFile = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port.pid"
$watchdogScript = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port-watchdog.ps1"

function Write-Step {
  param([string]$Message)
  Write-Host "[$((Get-Date).ToUniversalTime().ToString('o'))] $Message"
}

function Test-PortFree {
  param([int]$PortToCheck)
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $PortToCheck)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-PortOwner {
  $row = netstat -ano -p tcp | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
  if (-not $row) { return $null }
  $parts = ($row.Line -split '\s+') | Where-Object { $_ }
  return [int]$parts[4]
}

function Stop-Tree {
  param([int]$TargetPid, [string]$Name)
  $killOut = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port-$Name-taskkill.out.log"
  $killErr = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port-$Name-taskkill.err.log"
  Write-Step "TASKKILL START $Name pid=$TargetPid"
  $kill = Start-Process -FilePath 'taskkill.exe' `
    -ArgumentList @('/PID', "$TargetPid", '/T', '/F') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $killOut `
    -RedirectStandardError $killErr `
    -PassThru
  if (-not $kill.WaitForExit(10000)) {
    Write-Step "TASKKILL TIMEOUT $Name pid=$TargetPid"
    return $false
  }
  $stdoutRaw = if (Test-Path $killOut) { Get-Content -Raw $killOut } else { '' }
  $stderrRaw = if (Test-Path $killErr) { Get-Content -Raw $killErr } else { '' }
  $stdout = if ($null -eq $stdoutRaw) { '' } else { $stdoutRaw.Trim() }
  $stderr = if ($null -eq $stderrRaw) { '' } else { $stderrRaw.Trim() }
  Write-Step "TASKKILL END $Name exit=$($kill.ExitCode) stdout=$stdout stderr=$stderr"
  return ($kill.ExitCode -eq 0)
}

function Invoke-RouteCheck {
  param([string]$Route)
  $routeStarted = Get-Date
  $routeKey = ($Route -replace '[^A-Za-z0-9_-]', '_').Trim('_')
  if (-not $routeKey) { $routeKey = 'root' }
  $routeOut = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port-route-$routeKey.json"
  $routeErr = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port-route-$routeKey.err.log"
  Remove-Item -LiteralPath $routeOut, $routeErr -Force -ErrorAction SilentlyContinue
  $uri = "$baseUrl$Route"
  $command = @"
`$ErrorActionPreference = 'Stop'
try {
  `$response = Invoke-WebRequest -Uri '$uri' -UseBasicParsing -TimeoutSec $RouteTimeoutSeconds
  [ordered]@{
    route = '$Route'
    status = [int]`$response.StatusCode
    ok = ([int]`$response.StatusCode -ge 200 -and [int]`$response.StatusCode -lt 400)
    timedOut = `$false
    bytes = `$response.RawContentLength
  } | ConvertTo-Json -Compress
} catch {
  [ordered]@{
    route = '$Route'
    status = 'TIMEOUT_OR_ERROR'
    ok = `$false
    timedOut = `$true
    bytes = 0
    error = `$_.Exception.Message
  } | ConvertTo-Json -Compress
  exit 2
}
"@
  Write-Step "ROUTE START $Route"
  $routeProc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $routeOut `
    -RedirectStandardError $routeErr `
    -PassThru
  if (-not $routeProc.WaitForExit($RouteTimeoutSeconds * 1000)) {
    & taskkill /PID $routeProc.Id /T /F | Out-Null
    Write-Step "ROUTE TIMEOUT $Route"
    return [ordered]@{
      route = $Route
      status = 'TIMEOUT'
      ok = $false
      timedOut = $true
      bytes = 0
      ms = [int]((Get-Date) - $routeStarted).TotalMilliseconds
      error = "Route exceeded process timeout of $RouteTimeoutSeconds seconds."
    }
  }
  $text = if (Test-Path $routeOut) { Get-Content -Raw $routeOut } else { '' }
  $err = if (Test-Path $routeErr) { Get-Content -Raw $routeErr } else { '' }
  try {
    $parsed = $text | ConvertFrom-Json
    Write-Step "ROUTE END $Route status=$($parsed.status)"
    return [ordered]@{
      route = $Route
      status = $parsed.status
      ok = [bool]$parsed.ok
      timedOut = [bool]$parsed.timedOut
      bytes = $parsed.bytes
      ms = [int]((Get-Date) - $routeStarted).TotalMilliseconds
      error = $parsed.error
    }
  } catch {
    Write-Step "ROUTE ERROR $Route"
    return [ordered]@{
      route = $Route
      status = 'INVALID_ROUTE_OUTPUT'
      ok = $false
      timedOut = $false
      bytes = 0
      ms = [int]((Get-Date) - $routeStarted).TotalMilliseconds
      error = "stdout=$text stderr=$err"
    }
  }
}

try {
  Write-Step "SMOKE START port=$Port totalTimeoutSeconds=$TotalTimeoutSeconds routeTimeoutSeconds=$RouteTimeoutSeconds routes=$($Routes -join '|')"
  if (-not (Test-PortFree -PortToCheck $Port)) {
    throw "Port $Port is already in use before smoke startup."
  }
  Write-Step "PORT FREE BEFORE startup port=$Port"

  Set-Content -LiteralPath $markerFile -Value ([System.Diagnostics.Process]::GetCurrentProcess().Id)
  @"
param([string]`$MarkerFile, [int]`$ParentPid, [string]`$ServerPidFile, [int]`$TimeoutSeconds)
Start-Sleep -Seconds `$TimeoutSeconds
if (Test-Path -LiteralPath `$MarkerFile) {
  if (Test-Path -LiteralPath `$ServerPidFile) {
    `$serverPid = Get-Content -LiteralPath `$ServerPidFile -ErrorAction SilentlyContinue
    if (`$serverPid) { taskkill /PID `$serverPid /T /F | Out-Null }
  }
  taskkill /PID `$ParentPid /T /F | Out-Null
}
"@ | Set-Content -LiteralPath $watchdogScript
  $watchdog = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $watchdogScript, '-MarkerFile', $markerFile, '-ParentPid', ([System.Diagnostics.Process]::GetCurrentProcess().Id), '-ServerPidFile', $serverPidFile, '-TimeoutSeconds', $TotalTimeoutSeconds) `
    -WindowStyle Hidden `
    -PassThru

  Write-Step "SERVER START"
  $server = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'start', '--', '-p', "$Port", '-H', '127.0.0.1') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile `
    -PassThru
  Set-Content -LiteralPath $serverPidFile -Value $server.Id
  Write-Step "SERVER PID $($server.Id)"

  do {
    if ((Get-Date) -ge $deadline) {
      throw "Server readiness exceeded total cap of $TotalTimeoutSeconds seconds."
    }
    if ($server.HasExited) {
      $stderr = if (Test-Path $errFile) { Get-Content -Raw $errFile } else { '' }
      throw "Server exited before readiness. $stderr"
    }
    try {
      Write-Step "READINESS CHECK /api/system/version"
      $health = Invoke-WebRequest -Uri "$baseUrl/api/system/version" -UseBasicParsing -TimeoutSec 3
      if ([int]$health.StatusCode -ge 200 -and [int]$health.StatusCode -lt 400) {
        Write-Step "READINESS OK status=$($health.StatusCode)"
        break
      }
    } catch {
      Write-Step "READINESS WAIT $($_.Exception.Message)"
      Start-Sleep -Milliseconds 500
    }
  } while ($true)

  foreach ($route in $Routes) {
    if ((Get-Date) -ge $deadline) {
      $results.Add([ordered]@{
        route = $route
        status = 'TOTAL_TIMEOUT'
        ok = $false
        timedOut = $true
        bytes = 0
        ms = [int]((Get-Date) - $startedAt).TotalMilliseconds
        error = "Total smoke cap reached before this route."
      })
      continue
    }
    $results.Add((Invoke-RouteCheck -Route $route))
  }
} finally {
  Write-Step "CLEANUP START"
  if ($server -and -not $server.HasExited) {
    Stop-Tree -TargetPid $server.Id -Name 'server-root' | Out-Null
    Start-Sleep -Milliseconds 500
  }
  $ownerPid = Get-PortOwner
  if ($ownerPid) {
    Write-Step "CLEANUP PORT OWNER pid=$ownerPid"
    Stop-Tree -TargetPid $ownerPid -Name 'port-owner' | Out-Null
    Start-Sleep -Milliseconds 500
  }
  Remove-Item -LiteralPath $markerFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $serverPidFile -Force -ErrorAction SilentlyContinue
  if ($watchdog -and -not $watchdog.HasExited) {
    Stop-Tree -TargetPid $watchdog.Id -Name 'watchdog' | Out-Null
  }
  Write-Step "CLEANUP END"
}

$portFreeAfter = Test-PortFree -PortToCheck $Port
$failed = @($results | Where-Object { -not $_.ok })
$payload = [ordered]@{
  success = ($failed.Count -eq 0)
  mode = 'POWERSHELL_WRAPPER_TASKKILL'
  baseUrl = $baseUrl
  pid = if ($server) { $server.Id } else { $null }
  routes = @($results.ToArray())
  portFreeAfter = $portFreeAfter
  totalMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
  providerCallsMade = 0
  remoteMutationsMade = 0
}

$payload | ConvertTo-Json -Depth 8
if ($failed.Count -gt 0 -or -not $portFreeAfter) { exit 1 }
exit 0
