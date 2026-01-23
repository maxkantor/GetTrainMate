Param(
  [string]$ApiUrl = $env:API_URL
)

if (-not $ApiUrl -or $ApiUrl.Trim() -eq "") {
  $ApiUrl = "http://localhost:3001"
}

Write-Host "Seeding CMS content to $ApiUrl" -ForegroundColor Cyan

$adminToken = $env:ADMIN_TOKEN
if (-not $adminToken) {
  $adminToken = Read-Host "Enter Admin Token (or set ADMIN_TOKEN env var)"
}

if (-not $adminToken -or $adminToken.Trim() -eq "") {
  Write-Error "Admin token is required. Obtain it via POST $ApiUrl/api/admin/login"
  exit 1
}

$Headers = @{ "X-Admin-Token" = $adminToken; "Content-Type" = "application/json" }

$seedItems = @(
  @{ contentType = "landing_hero"; title = "Train Better Together"; body = "Find your perfect training partner and join local events."; translations = @{ es = "Entrena mejor juntos"; fr = "Entrainez-vous mieux ensemble" }; status = "published" },
  @{ contentType = "feature"; title = "Smart Matching"; body = "We match by sport, schedule, and skill."; translations = @{ es = "Emparejamos por deporte, horario y nivel" }; status = "published" },
  @{ contentType = "feature"; title = "Local Events"; body = "Discover and join group training events nearby."; translations = @{}; status = "published" },
  @{ contentType = "testimonial"; title = "I found my marathon buddy!"; body = "The matching was spot on and convenient."; translations = @{}; status = "published" },
  @{ contentType = "faq"; title = "Is it free to use?"; body = "Yes, with optional premium features."; translations = @{}; status = "published" },
  @{ contentType = "blog"; title = "5 Tips to Stay Consistent"; body = "Consistency beats intensity. Start small, track progress, and celebrate wins."; translations = @{}; status = "draft" }
)

function Invoke-ApiPost($url, $payload) {
  try {
    $json = $payload | ConvertTo-Json -Depth 10
    return Invoke-RestMethod -Method Post -Uri $url -Headers $Headers -Body $json
  }
  catch {
    Write-Warning ("POST failed: " + $_.Exception.Message)
  }
}

# Create items
foreach ($item in $seedItems) {
  $res = Invoke-ApiPost "$ApiUrl/api/cms" $item
  if ($res) {
    Write-Host ("Created: {0}/{1} [{2}]" -f $res.contentType, $res.contentId, $res.status) -ForegroundColor Green
  }
}

# Publish any drafts explicitly
try {
  $list = Invoke-RestMethod -Method Get -Uri "$ApiUrl/api/cms?status=draft&limit=200" -Headers $Headers
  foreach ($i in $list) {
    if ($i.contentType -and $i.contentId) {
      $p = Invoke-ApiPost "$ApiUrl/api/cms/$($i.contentType)/$($i.contentId)/publish" @{}
      if ($p) { Write-Host ("Published: {0}/{1}" -f $p.contentType, $p.contentId) -ForegroundColor Yellow }
    }
  }
}
catch {
  Write-Warning ("List/publish phase warning: " + $_.Exception.Message)
}

Write-Host "CMS seeding complete." -ForegroundColor Cyan
