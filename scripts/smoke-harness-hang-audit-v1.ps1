param(
  [int]$Port = 3048,
  [string[]]$Routes = @('/api/system/version', '/dashboard', '/login', '/register'),
  [int]$PhaseTimeoutSeconds = 120,
  [int]$RouteTimeoutSeconds = 12
)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$baseUrl = "http://127.0.0.1:$Port"
$Routes = @($Routes | ForEach-Object { "$_".Split(',', [System.StringSplitOptions]::RemoveEmptyEntries) } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$auditId = "pick-analyzer-smoke-audit-$Port"
$auditLog = Join-Path $env:TEMP "$auditId.log"
$serverOut = Join-Path $env:TEMP "$auditId-server.out.log"
$serverErr = Join-Path $env:TEMP "$auditId-server.err.log"
$phaseDir = Join-Path $env:TEMP $auditId
if (-not (Test-Path $phaseDir)) { New-Item -ItemType Directory -Path $phaseDir | Out-Null }

function Write-Audit {
  param([string]$Message)
  $line = "[$((Get-Date).ToUniversalTime().ToString('o'))] $Message"
  Add-Content -LiteralPath $auditLog -Value $line
  Write-Host $line
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
  return [ordered]@{
    protocol = $parts[0]
    local = $parts[1]
    remote = $parts[2]
    state = $parts[3]
    pid = [int]$parts[4]
  }
}

function Read-TextFile {
  param([string]$Path)
  if (Test-Path $Path) {
    $text = Get-Content -Raw $Path
    if ($null -eq $text) { return '' }
    return [string]$text
  }
  return ''
}

function Start-Watchdog {
  param(
    [int]$TargetPid,
    [int]$TimeoutSeconds,
    [string]$Name
  )
  $script = Join-Path $phaseDir "$Name-watchdog.ps1"
  $out = Join-Path $phaseDir "$Name-watchdog.out.log"
  $err = Join-Path $phaseDir "$Name-watchdog.err.log"
  @"
param([int]`$TargetPid, [int]`$TimeoutSeconds)
Start-Sleep -Seconds `$TimeoutSeconds
taskkill /PID `$TargetPid /T /F
"@ | Set-Content -LiteralPath $script
  Write-Audit "WATCHDOG START name=$Name targetPid=$TargetPid timeoutSeconds=$TimeoutSeconds"
  return Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script, '-TargetPid', $TargetPid, '-TimeoutSeconds', $TimeoutSeconds) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru
}

function Stop-ProcessTreeBounded {
  param(
    [int]$TargetPid,
    [string]$Name,
    [int]$TimeoutSeconds = 15
  )
  $out = Join-Path $phaseDir "$Name-taskkill.out.log"
  $err = Join-Path $phaseDir "$Name-taskkill.err.log"
  Write-Audit "TASKKILL START name=$Name targetPid=$TargetPid"
  $proc = Start-Process -FilePath 'taskkill.exe' `
    -ArgumentList @('/PID', "$TargetPid", '/T', '/F') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru
  if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
    Write-Audit "TASKKILL TIMEOUT name=$Name targetPid=$TargetPid"
    return $false
  }
  $stdoutRaw = if (Test-Path $out) { Get-Content -Raw $out } else { '' }
  $stderrRaw = if (Test-Path $err) { Get-Content -Raw $err } else { '' }
  $stdout = if ($null -eq $stdoutRaw) { '' } else { $stdoutRaw.Trim() }
  $stderr = if ($null -eq $stderrRaw) { '' } else { $stderrRaw.Trim() }
  Write-Audit "TASKKILL END name=$Name exitCode=$($proc.ExitCode) stdout=$stdout stderr=$stderr"
  return ($proc.ExitCode -eq 0)
}

function Invoke-BoundedPowerShell {
  param(
    [string]$Name,
    [string]$Command,
    [int]$TimeoutSeconds
  )
  $out = Join-Path $phaseDir "$Name.out.log"
  $err = Join-Path $phaseDir "$Name.err.log"
  Write-Audit "PHASE START name=$Name timeoutSeconds=$TimeoutSeconds"
  $proc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $Command) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru
  Write-Audit "PHASE PID name=$Name pid=$($proc.Id)"
  $watchdog = Start-Watchdog -TargetPid $proc.Id -TimeoutSeconds $TimeoutSeconds -Name $Name
  $exited = $proc.WaitForExit(($TimeoutSeconds + 10) * 1000)
  if (-not $exited) {
    Write-Audit "PHASE WAIT TIMEOUT name=$Name pid=$($proc.Id)"
    Stop-ProcessTreeBounded -TargetPid $proc.Id -Name "$Name-late-kill" | Out-Null
  } else {
    Write-Audit "PHASE END name=$Name exitCode=$($proc.ExitCode)"
  }
  if ($watchdog -and -not $watchdog.HasExited) {
    Stop-ProcessTreeBounded -TargetPid $watchdog.Id -Name "$Name-watchdog-cleanup" | Out-Null
  }
  return [ordered]@{
    name = $Name
    pid = $proc.Id
    exited = $exited
    exitCode = if ($exited) { $proc.ExitCode } else { $null }
    stdout = Read-TextFile -Path $out
    stderr = Read-TextFile -Path $err
  }
}

Remove-Item -LiteralPath $auditLog, $serverOut, $serverErr -Force -ErrorAction SilentlyContinue
Write-Audit "AUDIT START port=$Port phaseTimeoutSeconds=$PhaseTimeoutSeconds routeTimeoutSeconds=$RouteTimeoutSeconds"
Write-Audit "PORT BEFORE free=$(Test-PortFree -PortToCheck $Port) owner=$(ConvertTo-Json (Get-PortOwner) -Compress)"

$server = $null
$results = New-Object System.Collections.Generic.List[object]

try {
  if (-not (Test-PortFree -PortToCheck $Port)) {
    throw "Port $Port is not free before audit."
  }

  Write-Audit "PHASE A SERVER START begin"
  $server = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'start', '--', '-p', "$Port", '-H', '127.0.0.1') `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru
  Write-Audit "PHASE A SERVER START end pid=$($server.Id)"

  $deadline = (Get-Date).AddSeconds($PhaseTimeoutSeconds)
  do {
    if ((Get-Date) -gt $deadline) {
      throw "Phase A startup observation exceeded $PhaseTimeoutSeconds seconds."
    }
    $owner = Get-PortOwner
    Write-Audit "PHASE A PORT OBSERVE owner=$(ConvertTo-Json $owner -Compress)"
    if ($owner) { break }
    Start-Sleep -Milliseconds 500
  } while ($true)

  $readiness = Invoke-BoundedPowerShell -Name 'phase-b-readiness' -TimeoutSeconds 20 -Command @"
`$ErrorActionPreference = 'Stop'
`$response = Invoke-WebRequest -Uri '$baseUrl/api/system/version' -UseBasicParsing -TimeoutSec 8
[ordered]@{ status = [int]`$response.StatusCode; length = `$response.RawContentLength } | ConvertTo-Json -Compress
"@
  $results.Add($readiness)

  foreach ($route in $Routes) {
    $safe = ($route -replace '[^A-Za-z0-9_-]', '_').Trim('_')
    if (-not $safe) { $safe = 'root' }
    $routeResult = Invoke-BoundedPowerShell -Name "phase-c-route-$safe" -TimeoutSeconds ($RouteTimeoutSeconds + 8) -Command @"
`$ErrorActionPreference = 'Stop'
`$response = Invoke-WebRequest -Uri '$baseUrl$route' -UseBasicParsing -TimeoutSec $RouteTimeoutSeconds
[ordered]@{ route = '$route'; status = [int]`$response.StatusCode; length = `$response.RawContentLength } | ConvertTo-Json -Compress
"@
    $results.Add($routeResult)
    if (-not $routeResult.exited) {
      throw "Route phase exceeded deadline: $route"
    }
  }
} finally {
  if ($server) {
    Write-Audit "PHASE D CLEANUP begin serverPid=$($server.Id)"
    Stop-ProcessTreeBounded -TargetPid $server.Id -Name 'phase-d-server-cleanup' | Out-Null
    Start-Sleep -Milliseconds 750
    $owner = Get-PortOwner
    if ($owner) {
      Write-Audit "PHASE D CLEANUP portOwnerPid=$($owner.pid)"
      Stop-ProcessTreeBounded -TargetPid $owner.pid -Name 'phase-d-port-owner-cleanup' | Out-Null
      Start-Sleep -Milliseconds 750
    }
    Write-Audit "PHASE D CLEANUP end portFree=$(Test-PortFree -PortToCheck $Port) owner=$(ConvertTo-Json (Get-PortOwner) -Compress)"
  }
}

$payload = [ordered]@{
  success = (Test-PortFree -PortToCheck $Port)
  auditLog = $auditLog
  serverPid = if ($server) { $server.Id } else { $null }
  portFreeAfter = Test-PortFree -PortToCheck $Port
  portOwnerAfter = Get-PortOwner
  serverStdout = @((Read-TextFile -Path $serverOut) -split "`r?`n" | Select-Object -Last 20)
  serverStderr = @((Read-TextFile -Path $serverErr) -split "`r?`n" | Select-Object -Last 20)
  phaseResults = @($results.ToArray())
}

$payload | ConvertTo-Json -Depth 8
if (-not $payload.success) { exit 1 }
exit 0
