#!/usr/bin/env pwsh
# Upload marketing images to S3 bucket

param(
  [string]$BucketName = "gettrainmate-media-bucket",
  [string]$Region = "us-east-1"
)

$Images = @(
  @{
    Name = "Strength training"
    LocalPath = "assets/images/pricing-vibe/strength.jpg"
    S3Key = "pricing/vibe/strength.jpg"
    Url = "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80"
  },
  @{
    Name = "Running outdoors"
    LocalPath = "assets/images/pricing-vibe/running.jpg"
    S3Key = "pricing/vibe/running.jpg"
    Url = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80"
  },
  @{
    Name = "Yoga practice"
    LocalPath = "assets/images/pricing-vibe/yoga.jpg"
    S3Key = "pricing/vibe/yoga.jpg"
    Url = "https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80"
  },
  @{
    Name = "Cycling"
    LocalPath = "assets/images/pricing-vibe/cycling.jpg"
    S3Key = "pricing/vibe/cycling.jpg"
    Url = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80"
  },
  @{
    Name = "Gym motivation"
    LocalPath = "assets/images/pricing-vibe/gym.jpg"
    S3Key = "pricing/vibe/gym.jpg"
    Url = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80"
  },
  @{
    Name = "Fitness training"
    LocalPath = "assets/images/pricing-vibe/fitness.jpg"
    S3Key = "pricing/vibe/fitness.jpg"
    Url = "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80"
  }
)

Write-Host "GetTrainMate S3 Image Upload Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  Write-Host "Error: AWS CLI not found" -ForegroundColor Red
  exit 1
}

Write-Host "Checking S3 bucket..." -ForegroundColor Yellow
try {
  aws s3 ls "s3://$BucketName" --region $Region | Out-Null
  Write-Host "Bucket accessible" -ForegroundColor Green
}
catch {
  Write-Host "Cannot access bucket" -ForegroundColor Red
  exit 1
}

$AssetDir = "assets/images/pricing-vibe"
if (-not (Test-Path $AssetDir)) {
  New-Item -ItemType Directory -Path $AssetDir -Force | Out-Null
  Write-Host "Created directory: $AssetDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "Downloading images..." -ForegroundColor Yellow

foreach ($img in $Images) {
  $LocalFile = $img.LocalPath
  if (-not (Test-Path $LocalFile)) {
    Write-Host "  Downloading: $($img.Name)" -ForegroundColor Cyan
    try {
      Invoke-WebRequest -Uri $img.Url -OutFile $LocalFile -TimeoutSec 30
      Write-Host "  Saved: $LocalFile" -ForegroundColor Green
    }
    catch {
      Write-Host "  Failed: $_" -ForegroundColor Red
    }
  }
}

Write-Host ""
Write-Host "Uploading to S3..." -ForegroundColor Yellow

$SuccessCount = 0

foreach ($img in $Images) {
  $LocalFile = $img.LocalPath
  $S3Key = $img.S3Key
  
  if (Test-Path $LocalFile) {
    Write-Host "  Uploading: $($img.Name)" -ForegroundColor Cyan
    try {
      aws s3 cp $LocalFile "s3://$BucketName/$S3Key" --region $Region --cache-control "max-age=31536000" | Out-Null
      Write-Host "    Done" -ForegroundColor Green
      $SuccessCount++
    }
    catch {
      Write-Host "    Failed: $_" -ForegroundColor Red
    }
  }
}

Write-Host ""
Write-Host "Complete! Uploaded $SuccessCount/$($Images.Count) images" -ForegroundColor Cyan
