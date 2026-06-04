param(
  [string]$Version = "10.0.9",
  [string]$Repo = "ercaslehon/vtm-revised-foundry-system"
)

$ErrorActionPreference = "Stop"

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false, $true)
$Utf8Strict = [System.Text.UTF8Encoding]::new($false, $true)
$Cp1251 = [System.Text.Encoding]::GetEncoding(
  1251,
  [System.Text.EncoderExceptionFallback]::new(),
  [System.Text.DecoderExceptionFallback]::new()
)

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )

  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $Utf8NoBom)
}

function Test-NoBom {
  param([Parameter(Mandatory=$true)][string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $Path))
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    throw "$Path contains UTF-8 BOM"
  }
}

function Get-MojibakeScore {
  param([string]$Text)

  if ([string]::IsNullOrEmpty($Text)) {
    return 0
  }

  $patterns = @(
    "Рђ","Р‘","Р’","Р“","Р”","Р•","Р–","Р—","Р�","Р™","Рљ","Р›","Рњ","Рќ","Рћ","Рџ",
    "Р ","РЎ","Рў","РЈ","Р¤","РҐ","Р¦","Р§","РЁ","Р©","РЄ","Р«","Р¬","Р­","Р®","РЇ",
    "Р°","Р±","РІ","Рі","Рґ","Рµ","Р¶","Р·","Рё","Р№","Рє","Р»","Рј","РЅ","Рѕ","Рї",
    "СЂ","СЃ","С‚","Сѓ","С„","С…","С†","С‡","С€","С‰","СЉ","С‹","СЊ","СЌ","СЋ","СЏ","С‘",
    "Р В","Р’В","РЎС","В·","В«","В»","В ","Â","Ð","Ñ","�"
  )

  $score = 0
  foreach ($pattern in $patterns) {
    $score += ([regex]::Matches($Text, [regex]::Escape($pattern))).Count
  }

  return $score
}

function Repair-MojibakeLine {
  param([string]$Line)

  $current = $Line
  $score = Get-MojibakeScore $current

  if ($score -le 0) {
    return $current
  }

  for ($i = 0; $i -lt 5; $i++) {
    try {
      $bytes = $Cp1251.GetBytes($current)
      $candidate = $Utf8Strict.GetString($bytes)
    }
    catch {
      break
    }

    $candidateScore = Get-MojibakeScore $candidate

    if ($candidateScore -lt $score) {
      $current = $candidate
      $score = $candidateScore
    }
    else {
      break
    }
  }

  return $current
}

function Repair-MojibakeText {
  param([string]$Text)

  $parts = [regex]::Split($Text, "(\r\n|\n|\r)")
  $out = New-Object System.Collections.Generic.List[string]

  foreach ($part in $parts) {
    if ($part -eq "`r`n" -or $part -eq "`n" -or $part -eq "`r") {
      $out.Add($part)
    }
    else {
      $out.Add((Repair-MojibakeLine $part))
    }
  }

  return ($out -join "")
}

function Read-TextFileUtf8 {
  param([string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $Path))

  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bytes = $bytes[3..($bytes.Length - 1)]
  }

  return $Utf8Strict.GetString($bytes)
}

$textExtensions = @(
  ".md", ".json", ".mjs", ".js", ".cjs", ".hbs", ".css", ".scss",
  ".html", ".txt", ".yml", ".yaml", ".ps1", ".ts"
)

$excludeDirs = @(
  "\.git\",
  "\node_modules\",
  "\.encoding-backup-"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Get-Location) ".encoding-backup-$timestamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null

$changed = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

Get-ChildItem -Recurse -File -Force | Where-Object {
  $path = $_.FullName
  $ext = $_.Extension.ToLowerInvariant()

  if ($textExtensions -notcontains $ext) {
    return $false
  }

  foreach ($exclude in $excludeDirs) {
    if ($path -like "*$exclude*") {
      return $false
    }
  }

  return $true
} | ForEach-Object {
  $file = $_.FullName
  $relative = Resolve-Path -Relative $file

  try {
    $text = Read-TextFileUtf8 $file
    $repaired = Repair-MojibakeText $text

    if ($repaired -ne $text -or (Get-MojibakeScore $text) -gt 0) {
      $backupPath = Join-Path $backupDir ($relative.TrimStart(".\").Replace("\", "__"))
      Copy-Item $file $backupPath -Force
      Write-Utf8NoBom -Path $file -Content $repaired
      $changed.Add($relative)
    }
    else {
      Write-Utf8NoBom -Path $file -Content $text
    }

    Test-NoBom $file
  }
  catch {
    $skipped.Add("$relative :: $($_.Exception.Message)")
  }
}

Write-Host ""
Write-Host "Changed files:"
$changed | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "Skipped files:"
$skipped | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "Backup dir: $backupDir"
