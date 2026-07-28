param(
  [Parameter(Mandatory = $true)][string]$Route,
  [int]$Port = 3048,
  [int]$StartupTimeoutSeconds = 45,
  [int]$RouteTimeoutSeconds = 20,
  [int]$TotalTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$startedAt = Get-Date
$deadline = $startedAt.AddSeconds($TotalTimeoutSeconds)
$baseUrl = "http://127.0.0.1:$Port"
$server = $null
$watchdog = $null
$outFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.out.log"
$errFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.err.log"
$watchdogFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.watchdog.ps1"
$httpBodyFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.http.body"
$httpStatusFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.http.status"
$httpErrFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.http.err"

function Stamp {
  param([string]$Message)
  "[$((Get-Date).ToUniversalTime().ToString('o'))] $Message"
}

function Write-Step {
  param([string]$Message)
  Write-Host (Stamp $Message)
}

function Assert-Deadline {
  param([string]$Step)
  if ((Get-Date) -ge $deadline) {
    throw "Total timeout reached during $Step"
  }
}

function Get-PortOwner {
  $row = netstat -ano -p tcp | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
  if (-not $row) { return $null }
  $parts = ($row.Line -split '\s+') | Where-Object { $_ }
  return [int]$parts[4]
}

function Stop-Tree {
  param([int]$TargetPid, [string]$Label)
  if (-not $TargetPid) { return }
  Write-Step "TASKKILL START $Label pid=$TargetPid"
  $kill = Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', "$TargetPid", '/T', '/F') -WindowStyle Hidden -PassThru
  if (-not $kill.WaitForExit(10000)) {
    Write-Step "TASKKILL TIMEOUT $Label pid=$TargetPid"
  } else {
    Write-Step "TASKKILL END $Label exit=$($kill.ExitCode)"
  }
}

function Invoke-CurlBounded {
  param([string]$Uri, [int]$TimeoutSeconds)

  Remove-Item -LiteralPath $httpBodyFile, $httpStatusFile, $httpErrFile -Force -ErrorAction SilentlyContinue
  $arguments = @(
    '--silent',
    '--show-error',
    '--location',
    '--connect-timeout',
    '2',
    '--max-time',
    "$TimeoutSeconds",
    '--output',
    $httpBodyFile,
    '--write-out',
    '%{http_code}',
    $Uri
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'curl.exe'
  $startInfo.Arguments = ($arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }) -join ' '
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()

  if (-not $process.WaitForExit(($TimeoutSeconds + 3) * 1000)) {
    Stop-Tree -TargetPid $process.Id -Label 'curl-timeout'
    return [ordered]@{ statusCode = 'TIMEOUT'; ok = $false; bytes = 0; error = "curl exceeded $TimeoutSeconds seconds" }
  }

  $rawStatus = $process.StandardOutput.ReadToEnd().Trim()
  $rawError = $process.StandardError.ReadToEnd().Trim()
  Set-Content -LiteralPath $httpStatusFile -Value $rawStatus -Encoding ASCII
  Set-Content -LiteralPath $httpErrFile -Value $rawError -Encoding UTF8
  $bodyBytes = if (Test-Path $httpBodyFile) { (Get-Item $httpBodyFile).Length } else { 0 }
  $status = 0
  if ([int]::TryParse($rawStatus, [ref]$status)) {
    return [ordered]@{ statusCode = $status; ok = ($status -ge 200 -and $status -lt 500); bytes = $bodyBytes; error = $rawError }
  }

  return [ordered]@{ statusCode = 'ERROR'; ok = $false; bytes = $bodyBytes; error = $rawError }
}

$result = [ordered]@{
  route = $Route
  port = $Port
  startTimestamp = $startedAt.ToUniversalTime().ToString('o')
  endTimestamp = $null
  statusCode = $null
  elapsedMs = $null
  timeout = $false
  failureReason = $null
  cleanup = [ordered]@{}
}

try {
  Write-Step "SINGLE SMOKE START route=$Route port=$Port totalTimeout=$TotalTimeoutSeconds"
  $preOwner = Get-PortOwner
  if ($preOwner) { throw "Port $Port already in use by PID $preOwner" }

  Remove-Item -LiteralPath $outFile, $errFile, $watchdogFile, $httpBodyFile, $httpStatusFile, $httpErrFile -Force -ErrorAction SilentlyContinue
  @"
Start-Sleep -Seconds $TotalTimeoutSeconds
`$ownerLine = netstat -ano -p tcp | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
if (`$ownerLine) {
  `$parts = (`$ownerLine.Line -split '\s+') | Where-Object { `$_ }
  if (`$parts.Length -ge 5) { taskkill.exe /PID `$parts[4] /T /F | Out-Null }
}
"@ | Set-Content -LiteralPath $watchdogFile -Encoding ASCII
  $watchdog = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $watchdogFile) `
    -WindowStyle Hidden `
    -PassThru
  Write-Step "WATCHDOG START pid=$($watchdog.Id)"

  Write-Step 'SERVER START BEGIN'
  $server = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'start', '--', '-p', "$Port", '-H', '127.0.0.1') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile `
    -PassThru
  Write-Step "SERVER START END pid=$($server.Id)"

  $ready = $false
  $startupDeadline = (Get-Date).AddSeconds([Math]::Min($StartupTimeoutSeconds, $TotalTimeoutSeconds - 5))
  while ((Get-Date) -lt $startupDeadline) {
    Assert-Deadline 'readiness polling'
    if ($server.HasExited) {
      $stderr = if (Test-Path $errFile) { Get-Content -Raw $errFile } else { '' }
      throw "Server exited during startup. stderr=$stderr"
    }

    Write-Step "READINESS CHECK START $baseUrl/api/system/version"
    $readiness = Invoke-CurlBounded -Uri "$baseUrl/api/system/version" -TimeoutSeconds 5
    Write-Step "READINESS CHECK END status=$($readiness.statusCode)"
    if ($readiness.statusCode -eq 200) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "Server readiness exceeded $StartupTimeoutSeconds seconds" }
  Write-Step 'SERVER READY'

  Assert-Deadline 'route check'
  $routeStart = Get-Date
  Write-Step "ROUTE START $Route"
  $routeResult = Invoke-CurlBounded -Uri "$baseUrl$Route" -TimeoutSeconds $RouteTimeoutSeconds
  $routeEnd = Get-Date
  Write-Step "ROUTE END $Route status=$($routeResult.statusCode)"
  $result.statusCode = $routeResult.statusCode
  $result.elapsedMs = [int]($routeEnd - $routeStart).TotalMilliseconds
  $result.timeout = $routeResult.statusCode -eq 'TIMEOUT'
  $result.failureReason = $routeResult.error
} catch {
  $result.statusCode = 'HARNESS_ERROR'
  $result.failureReason = $_.Exception.Message
} finally {
  Write-Step 'CLEANUP START'
  if ($server -and -not $server.HasExited) {
    Stop-Tree -TargetPid $server.Id -Label 'server-root'
  }
  Start-Sleep -Milliseconds 500
  $owner = Get-PortOwner
  if ($owner) {
    Stop-Tree -TargetPid $owner -Label 'port-owner'
  }
  if ($watchdog -and -not $watchdog.HasExited) {
    Stop-Tree -TargetPid $watchdog.Id -Label 'watchdog'
  }
  Start-Sleep -Milliseconds 500
  $postOwner = Get-PortOwner
  $result.cleanup.portFreeAfter = ($null -eq $postOwner)
  $result.cleanup.remainingPortOwner = $postOwner
  $result.cleanup.serverPid = if ($server) { $server.Id } else { $null }
  $result.cleanup.watchdogPid = if ($watchdog) { $watchdog.Id } else { $null }
  $result.endTimestamp = (Get-Date).ToUniversalTime().ToString('o')
  if (-not $result.elapsedMs) { $result.elapsedMs = [int]((Get-Date) - $startedAt).TotalMilliseconds }
  Write-Step "CLEANUP END portFree=$($result.cleanup.portFreeAfter)"
  Remove-Item -LiteralPath $watchdogFile, $httpBodyFile, $httpStatusFile, $httpErrFile -Force -ErrorAction SilentlyContinue
}

$result | ConvertTo-Json -Depth 8
if ($result.statusCode -eq 'HARNESS_ERROR' -or $result.timeout -or -not $result.cleanup.portFreeAfter) { exit 1 }
if ($result.statusCode -is [int] -and $result.statusCode -ge 500) { exit 1 }
exit 0
