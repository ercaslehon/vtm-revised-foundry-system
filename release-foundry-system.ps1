param(
  [string]$Repo = "ercaslehon/vtm-revised-foundry-system",
  [string]$Branch = "main",
  [string]$Root = (Get-Location).Path,
  [string]$TokenFile = "C:\Users\Kac\.secrets\github_vtm_token.txt",
  [string]$Token = $env:GITHUB_TOKEN,
  [switch]$Draft,
  [switch]$Prerelease,
  [switch]$AllowDirty,
  [switch]$SkipGitChecks
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Text)

  Write-Host ""
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Fail {
  param([string]$Text)

  throw "[release failed] $Text"
}

function Test-CommandExists {
  param([string]$Name)

  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-GitOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$GitArgs
  )

  $output = & git @GitArgs 2>&1

  if ($LASTEXITCODE -ne 0) {
    Fail "git $($GitArgs -join ' ') failed: $output"
  }

  return ($output | Out-String).Trim()
}

function Get-ReleaseToken {
  if ($Token) {
    return $Token.Trim()
  }

  if (Test-Path $TokenFile) {
    $fromFile = (Get-Content $TokenFile -Raw).Trim()
    if ($fromFile) {
      return $fromFile
    }
  }

  $secure = Read-Host "Paste GitHub token" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Invoke-GitHubApi {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [object]$Body = $null,

    [string]$ContentType = "application/json"
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod `
      -Method $Method `
      -Uri $Uri `
      -Headers $Headers `
      -ErrorAction Stop
  }

  return Invoke-RestMethod `
    -Method $Method `
    -Uri $Uri `
    -Headers $Headers `
    -Body $Body `
    -ContentType $ContentType `
    -ErrorAction Stop
}

Write-Step "Preparing"

$Root = (Resolve-Path $Root).Path
Set-Location $Root

$systemPath = Join-Path $Root "system.json"

if (!(Test-Path $systemPath)) {
  Fail "system.json not found in $Root"
}

$system = Get-Content $systemPath -Raw | ConvertFrom-Json

if (!$system.version) {
  Fail "system.json has no version"
}

$version = [string]$system.version
$tag = if ($version.StartsWith("v")) { $version } else { "v$version" }
$assetName = "vtm-revised-$tag.zip"

$expectedUrl = "https://github.com/$Repo"
$expectedManifest = "https://raw.githubusercontent.com/$Repo/$Branch/system.json"
$expectedDownload = "https://github.com/$Repo/releases/download/$tag/$assetName"

Write-Host "Repo:      $Repo"
Write-Host "Branch:    $Branch"
Write-Host "Version:   $version"
Write-Host "Tag:       $tag"
Write-Host "Asset:     $assetName"

Write-Step "Checking system.json"

if ($system.url -ne $expectedUrl) {
  Fail "system.json url mismatch. Expected: $expectedUrl. Actual: $($system.url)"
}

if ($system.manifest -ne $expectedManifest) {
  Fail "system.json manifest mismatch. Expected: $expectedManifest. Actual: $($system.manifest)"
}

if ($system.manifest -like "*github.com*/blob/*") {
  Fail "system.json manifest uses GitHub blob URL. Foundry needs raw.githubusercontent.com"
}

if ($system.download -ne $expectedDownload) {
  Fail "system.json download mismatch. Expected: $expectedDownload. Actual: $($system.download)"
}

if (!$system.download.EndsWith(".zip")) {
  Fail "system.json download does not point to .zip"
}

Write-Host "system.json OK" -ForegroundColor Green

if (!$SkipGitChecks) {
  Write-Step "Checking git state"

  if (!(Test-CommandExists "git")) {
    Fail "git not found"
  }

  $branchNow = Get-GitOutput -GitArgs @("branch", "--show-current")

  if ($branchNow -ne $Branch) {
    Fail "Current branch is '$branchNow', expected '$Branch'"
  }

  $status = Get-GitOutput -GitArgs @("status", "--porcelain")

  if ($status -and !$AllowDirty) {
    Write-Host $status
    Fail "Working tree is not clean. Commit changes first or run with -AllowDirty"
  }

  $head = Get-GitOutput -GitArgs @("rev-parse", "HEAD")

  $remoteHeadRaw = Get-GitOutput -GitArgs @("ls-remote", "--heads", "origin", $Branch)

  if ($remoteHeadRaw -notmatch $head) {
    Fail "origin/$Branch does not point to local HEAD. Push main first."
  }

  $remoteTagRaw = Get-GitOutput -GitArgs @("ls-remote", "--tags", "origin", "$tag^{}")

  if ($remoteTagRaw -and ($remoteTagRaw -notmatch $head)) {
    Fail "remote tag $tag does not point to local HEAD. Move and force-push the tag first."
  }

  Write-Host "git OK: $head" -ForegroundColor Green
}

Write-Step "Optional catalog validation"

if ((Test-Path ".\package.json") -and (Test-Path ".\scripts\validate-catalogs.mjs") -and (Test-CommandExists "npm")) {
  npm run validate:catalogs

  if ($LASTEXITCODE -ne 0) {
    Fail "npm run validate:catalogs failed"
  }
}
else {
  Write-Host "Skipped npm validation. npm or validator not found." -ForegroundColor Yellow
}

Write-Step "Building archive"

$assetPath = Join-Path (Split-Path $Root -Parent) $assetName
$stage = Join-Path $env:TEMP "vtm-revised-release-$tag"

Remove-Item $assetPath -Force -ErrorAction SilentlyContinue
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path $stage | Out-Null

Get-ChildItem -Force $Root | Where-Object {
  $_.Name -notin @(".git", "node_modules", $assetName) -and
  $_.Name -notlike "vtm-revised-v*.zip"
} | ForEach-Object {
  Copy-Item $_.FullName -Destination $stage -Recurse -Force
}

Compress-Archive -Path "$stage\*" -DestinationPath $assetPath -Force
Remove-Item $stage -Recurse -Force

if (!(Test-Path $assetPath)) {
  Fail "Archive was not created: $assetPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($assetPath)

try {
  $hasManifest = $zip.Entries | Where-Object { $_.FullName -eq "system.json" }

  if (!$hasManifest) {
    Fail "Archive does not contain system.json at root. Foundry will sulk, and for once it will be right."
  }
}
finally {
  $zip.Dispose()
}

Write-Host "Created: $assetPath" -ForegroundColor Green
Write-Host "Size:    $((Get-Item $assetPath).Length) bytes"

Write-Step "Preparing GitHub API"

$releaseToken = Get-ReleaseToken

if (!$releaseToken) {
  Fail "GitHub token is empty. Put it into $TokenFile or set GITHUB_TOKEN."
}

$headers = @{
  "Authorization" = "Bearer $releaseToken"
  "Accept" = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "vtm-revised-release-uploader"
}

Write-Step "Creating or loading GitHub Release"

$release = $null

try {
  $release = Invoke-GitHubApi `
    -Method "GET" `
    -Uri "https://api.github.com/repos/$Repo/releases/tags/$tag" `
    -Headers $headers

  Write-Host "Release exists: $($release.html_url)"
}
catch {
  $status = $null

  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
  }

  if ($status -ne 404) {
    throw
  }

  $releaseBody = @{
    tag_name = $tag
    target_commitish = $Branch
    name = "VtM Revised $tag"
    body = "Stable installable Foundry VTT release."
    draft = [bool]$Draft
    prerelease = [bool]$Prerelease
  } | ConvertTo-Json

  $release = Invoke-GitHubApi `
    -Method "POST" `
    -Uri "https://api.github.com/repos/$Repo/releases" `
    -Headers $headers `
    -Body $releaseBody

  Write-Host "Release created: $($release.html_url)" -ForegroundColor Green
}

Write-Step "Uploading asset"

$assets = Invoke-GitHubApi `
  -Method "GET" `
  -Uri $release.assets_url `
  -Headers $headers

$existing = $assets | Where-Object { $_.name -eq $assetName }

foreach ($item in $existing) {
  Write-Host "Deleting existing asset: $($item.name)"

  Invoke-GitHubApi `
    -Method "DELETE" `
    -Uri "https://api.github.com/repos/$Repo/releases/assets/$($item.id)" `
    -Headers $headers | Out-Null
}

$encodedAssetName = [System.Uri]::EscapeDataString($assetName)
$uploadUrl = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$encodedAssetName"

$uploaded = Invoke-RestMethod `
  -Method "POST" `
  -Uri $uploadUrl `
  -Headers $headers `
  -ContentType "application/zip" `
  -InFile $assetPath `
  -ErrorAction Stop

Write-Host "Uploaded: $($uploaded.browser_download_url)" -ForegroundColor Green

Write-Step "Verifying public URLs"

$remoteManifest = Invoke-WebRequest $expectedManifest -UseBasicParsing
$remoteManifest.Content | ConvertFrom-Json | Out-Null

Write-Host "Manifest valid: $expectedManifest" -ForegroundColor Green

$zipHead = Invoke-WebRequest $expectedDownload -Method Head -UseBasicParsing

if ($zipHead.StatusCode -ne 200) {
  Fail "Download URL returned status $($zipHead.StatusCode)"
}

Write-Host "Download OK: $expectedDownload" -ForegroundColor Green

$releaseToken = $null

Write-Step "Done"

Write-Host "Release $tag is ready." -ForegroundColor Green
Write-Host "Foundry manifest URL:"
Write-Host $expectedManifest -ForegroundColor Green