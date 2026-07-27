param(
  [int]$Port = 3047,
  [string[]]$Routes = @('/api/system/version', '/dashboard', '/probability-picks', '/performance', '/player-projections', '/api/current-board', '/ai-operations'),
  [int]$RouteTimeoutSeconds = 12,
  [int]$TotalTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$baseUrl = "http://127.0.0.1:$Port"
$startedAt = Get-Date
$deadline = $startedAt.AddSeconds($TotalTimeoutSeconds)
$server = $null
$results = New-Object System.Collections.Generic.List[object]
$outFile = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port.out.log"
$errFile = Join-Path $env:TEMP "pick-analyzer-product-smoke-$Port.err.log"

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

function Invoke-RouteCheck {
  param([string]$Route)
  $routeStarted = Get-Date
  try {
    $response = Invoke-WebRequest -Uri "$baseUrl$Route" -UseBasicParsing -TimeoutSec $RouteTimeoutSeconds
    return [ordered]@{
      route = $Route
      status = [int]$response.StatusCode
      ok = ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400)
      timedOut = $false
      bytes = $response.RawContentLength
      ms = [int]((Get-Date) - $routeStarted).TotalMilliseconds
    }
  } catch {
    return [ordered]@{
      route = $Route
      status = 'TIMEOUT_OR_ERROR'
      ok = $false
      timedOut = $true
      bytes = 0
      ms = [int]((Get-Date) - $routeStarted).TotalMilliseconds
      error = $_.Exception.Message
    }
  }
}

try {
  if (-not (Test-PortFree -PortToCheck $Port)) {
    throw "Port $Port is already in use before smoke startup."
  }

  $server = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'start', '--', '-p', "$Port", '-H', '127.0.0.1') `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile `
    -PassThru

  do {
    if ((Get-Date) -ge $deadline) {
      throw "Server readiness exceeded total cap of $TotalTimeoutSeconds seconds."
    }
    if ($server.HasExited) {
      $stderr = if (Test-Path $errFile) { Get-Content -Raw $errFile } else { '' }
      throw "Server exited before readiness. $stderr"
    }
    try {
      $health = Invoke-WebRequest -Uri "$baseUrl/api/system/version" -UseBasicParsing -TimeoutSec 3
      if ([int]$health.StatusCode -ge 200 -and [int]$health.StatusCode -lt 400) {
        break
      }
    } catch {
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
  if ($server -and -not $server.HasExited) {
    & taskkill /PID $server.Id /T /F | Out-Null
    Start-Sleep -Milliseconds 500
  }
}

$portFreeAfter = Test-PortFree -PortToCheck $Port
$failed = @($results | Where-Object { -not $_.ok })
$payload = [ordered]@{
  success = ($failed.Count -eq 0)
  mode = 'POWERSHELL_WRAPPER_TASKKILL'
  baseUrl = $baseUrl
  pid = if ($server) { $server.Id } else { $null }
  routes = $results
  portFreeAfter = $portFreeAfter
  totalMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
  providerCallsMade = 0
  remoteMutationsMade = 0
}

$payload | ConvertTo-Json -Depth 8
if ($failed.Count -gt 0 -or -not $portFreeAfter) { exit 1 }
exit 0
