param(
  [Parameter(Mandatory = $true)][string]$Route,
  [int]$Port = 3048,
  [int]$StartupTimeoutSeconds = 45,
  [int]$RouteTimeoutSeconds = 20,
  [int]$TotalTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$startedAt = Get-Date
$deadline = $startedAt.AddSeconds($TotalTimeoutSeconds)
$baseUrl = "http://127.0.0.1:$Port"
$server = $null
$outFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.out.log"
$errFile = Join-Path $env:TEMP "pick-analyzer-single-smoke-$Port.err.log"

function Stamp {
  param([string]$Message)
  "[$((Get-Date).ToUniversalTime().ToString('o'))] $Message"
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
  Write-Host (Stamp "TASKKILL START $Label pid=$TargetPid")
  $kill = Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', "$TargetPid", '/T', '/F') -WindowStyle Hidden -PassThru
  if (-not $kill.WaitForExit(10000)) {
    Write-Host (Stamp "TASKKILL TIMEOUT $Label pid=$TargetPid")
  } else {
    Write-Host (Stamp "TASKKILL END $Label exit=$($kill.ExitCode)")
  }
}

function Invoke-BoundedHttp {
  param([string]$Uri, [int]$TimeoutSeconds)
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
  try {
    $task = $client.GetAsync($Uri)
    if (-not $task.Wait([TimeSpan]::FromSeconds($TimeoutSeconds + 2))) {
      return [ordered]@{ statusCode = 'TIMEOUT'; ok = $false; bytes = 0; error = "HTTP task exceeded $TimeoutSeconds seconds" }
    }
    $response = $task.Result
    $bodyTask = $response.Content.ReadAsStringAsync()
    if (-not $bodyTask.Wait([TimeSpan]::FromSeconds(5))) {
      return [ordered]@{ statusCode = [int]$response.StatusCode; ok = $false; bytes = 0; error = 'response body read timeout' }
    }
    $body = $bodyTask.Result
    return [ordered]@{ statusCode = [int]$response.StatusCode; ok = ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500); bytes = $body.Length; error = $null }
  } catch {
    return [ordered]@{ statusCode = 'ERROR'; ok = $false; bytes = 0; error = $_.Exception.Message }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
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
  Write-Host (Stamp "SINGLE SMOKE START route=$Route port=$Port")
  $preOwner = Get-PortOwner
  if ($preOwner) { throw "Port $Port already in use by PID $preOwner" }

  Remove-Item -LiteralPath $outFile, $errFile -Force -ErrorAction SilentlyContinue
  $server = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'start', '--', '-p', "$Port", '-H', '127.0.0.1') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile `
    -PassThru
  Write-Host (Stamp "SERVER START pid=$($server.Id)")

  $ready = $false
  while ((Get-Date) -lt $startedAt.AddSeconds($StartupTimeoutSeconds)) {
    if ($server.HasExited) { throw "Server exited during startup. stderr=$(if (Test-Path $errFile) { Get-Content -Raw $errFile })" }
    $readiness = Invoke-BoundedHttp -Uri "$baseUrl/api/system/version" -TimeoutSeconds 3
    if ($readiness.statusCode -eq 200) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "Server readiness exceeded $StartupTimeoutSeconds seconds" }
  Write-Host (Stamp 'SERVER READY')

  if ((Get-Date) -ge $deadline) { throw "Total timeout reached before route check" }
  $routeStart = Get-Date
  Write-Host (Stamp "ROUTE START $Route")
  $routeResult = Invoke-BoundedHttp -Uri "$baseUrl$Route" -TimeoutSeconds $RouteTimeoutSeconds
  $routeEnd = Get-Date
  Write-Host (Stamp "ROUTE END $Route status=$($routeResult.statusCode)")
  $result.statusCode = $routeResult.statusCode
  $result.elapsedMs = [int]($routeEnd - $routeStart).TotalMilliseconds
  $result.timeout = $routeResult.statusCode -eq 'TIMEOUT'
  $result.failureReason = $routeResult.error
} catch {
  $result.statusCode = 'HARNESS_ERROR'
  $result.failureReason = $_.Exception.Message
} finally {
  Write-Host (Stamp 'CLEANUP START')
  if ($server -and -not $server.HasExited) {
    Stop-Tree -TargetPid $server.Id -Label 'server-root'
  }
  Start-Sleep -Milliseconds 500
  $owner = Get-PortOwner
  if ($owner) {
    Stop-Tree -TargetPid $owner -Label 'port-owner'
  }
  Start-Sleep -Milliseconds 500
  $postOwner = Get-PortOwner
  $result.cleanup.portFreeAfter = ($null -eq $postOwner)
  $result.cleanup.remainingPortOwner = $postOwner
  $result.cleanup.serverPid = if ($server) { $server.Id } else { $null }
  $result.endTimestamp = (Get-Date).ToUniversalTime().ToString('o')
  if (-not $result.elapsedMs) { $result.elapsedMs = [int]((Get-Date) - $startedAt).TotalMilliseconds }
  Write-Host (Stamp "CLEANUP END portFree=$($result.cleanup.portFreeAfter)")
}

$result | ConvertTo-Json -Depth 8
if ($result.statusCode -eq 'HARNESS_ERROR' -or $result.timeout -or -not $result.cleanup.portFreeAfter) { exit 1 }
if ($result.statusCode -is [int] -and $result.statusCode -ge 500) { exit 1 }
