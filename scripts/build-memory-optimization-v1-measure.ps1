param(
  [string]$Label = "baseline",
  [int]$TimeoutSeconds = 600
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$docsDir = Join-Path $root "docs"
if (-not (Test-Path $docsDir)) { New-Item -ItemType Directory -Path $docsDir | Out-Null }

$startedAt = Get-Date
$stdout = Join-Path $env:TEMP "pick-analyzer-build-$Label.out.log"
$stderr = Join-Path $env:TEMP "pick-analyzer-build-$Label.err.log"
$outFile = Join-Path $docsDir "build-memory-optimization-v1-$Label.json"
$peakWorkingSetBytes = 0
$peakProcessCount = 0

Write-Host "[$((Get-Date).ToUniversalTime().ToString('o'))] BUILD START label=$Label"
$proc = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "build") -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

try {
  while (-not $proc.HasExited) {
    if ((Get-Date) -gt $deadline) {
      taskkill /PID $proc.Id /T /F | Out-Null
      throw "Build exceeded timeout of $TimeoutSeconds seconds."
    }
    $processes = Get-Process node,cmd,npm -ErrorAction SilentlyContinue | Where-Object {
      $_.StartTime -ge $startedAt.AddSeconds(-2)
    }
    $sum = ($processes | Measure-Object WorkingSet64 -Sum).Sum
    if ($sum -and $sum -gt $peakWorkingSetBytes) {
      $peakWorkingSetBytes = [int64]$sum
      $peakProcessCount = @($processes).Count
    }
    Start-Sleep -Milliseconds 750
    $proc.Refresh()
  }
} finally {
  if (-not $proc.HasExited) {
    taskkill /PID $proc.Id /T /F | Out-Null
  }
}

$finishedAt = Get-Date
$proc.WaitForExit()
$exitCode = if ($null -eq $proc.ExitCode) { 0 } else { $proc.ExitCode }
$durationSeconds = [math]::Round(($finishedAt - $startedAt).TotalSeconds, 2)
$stdoutText = if (Test-Path $stdout) { Get-Content $stdout -Raw } else { "" }
$stderrText = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { "" }

$manifest = node scripts/build-memory-optimization-v1-audit.mjs | ConvertFrom-Json
$generatedMatch = [regex]::Match($stdoutText, "Generating static pages.*\((\d+)/(\d+)\)")
$generatedPages = $null
if ($generatedMatch.Success) { $generatedPages = [int]$generatedMatch.Groups[2].Value }

$result = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  mode = "build_memory_optimization_v1_measurement"
  label = $Label
  exitCode = $exitCode
  success = ($exitCode -eq 0)
  startedAt = $startedAt.ToUniversalTime().ToString("o")
  finishedAt = $finishedAt.ToUniversalTime().ToString("o")
  durationSeconds = $durationSeconds
  peakWorkingSetBytes = $peakWorkingSetBytes
  peakWorkingSetMb = [math]::Round($peakWorkingSetBytes / 1MB, 1)
  peakObservedProcessCount = $peakProcessCount
  generatedStaticPagesFromOutput = $generatedPages
  prerenderRouteCount = $manifest.prerenderRouteCount
  routeManifestStaticRoutes = $manifest.routeManifestStaticRoutes
  routeManifestDynamicRoutes = $manifest.routeManifestDynamicRoutes
  largestServerFiles = $manifest.largestServerFiles | Select-Object -First 10
  stdoutTail = ($stdoutText -split "`r?`n" | Select-Object -Last 80)
  stderrTail = ($stderrText -split "`r?`n" | Select-Object -Last 40)
}

$result | ConvertTo-Json -Depth 8 | Set-Content $outFile
$result | ConvertTo-Json -Depth 8
if ($exitCode -ne 0) { exit $exitCode }
