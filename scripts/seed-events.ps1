Param(
  [string]$ApiUrl = $env:API_URL,
  [int]$Count = 12
)

if (-not $ApiUrl -or $ApiUrl.Trim() -eq "") { $ApiUrl = "http://localhost:3001" }

Write-Host "Seeding Events to $ApiUrl" -ForegroundColor Cyan

# Requires a regular user JWT token (not admin token)
# Obtain via your app's auth flow; then set:
#   $env:USER_TOKEN = "<jwt>"

$userToken = $env:USER_TOKEN
if (-not $userToken -or $userToken.Trim() -eq "") {
  $userToken = Read-Host "Enter User JWT (or set USER_TOKEN env var)"
}
if (-not $userToken) { Write-Error "A user JWT is required to create events."; exit 1 }

$Headers = @{ "Authorization" = "Bearer $userToken"; "Content-Type" = "application/json" }

# Sample data pools
$sports = @("Running","Cycling","Swimming","Tennis","Basketball","Soccer","Volleyball","Yoga","Hiking","Climbing","CrossFit","Gym")
$cities = @(
  @{ name = "New York"; lat = 40.7128; lon = -74.0060 },
  @{ name = "San Francisco"; lat = 37.7749; lon = -122.4194 },
  @{ name = "Chicago"; lat = 41.8781; lon = -87.6298 },
  @{ name = "Austin"; lat = 30.2672; lon = -97.7431 },
  @{ name = "Seattle"; lat = 47.6062; lon = -122.3321 },
  @{ name = "Miami"; lat = 25.7617; lon = -80.1918 }
)
$levels = @("beginner","intermediate","advanced")

function New-RandomEvent {
  param([int]$i)
  $sport = Get-Random -InputObject $sports
  $city = Get-Random -InputObject $cities
  $level = Get-Random -InputObject $levels
  $daysAhead = Get-Random -Minimum 2 -Maximum 45
  $hour = Get-Random -Minimum 6 -Maximum 20
  $max = Get-Random -Minimum 6 -Maximum 20

  $title = "$sport Session #$i"
  $desc = "Join us for a friendly $sport session in $($city.name). All $level welcome."
  $when = (Get-Date).ToUniversalTime().Date.AddDays($daysAhead).AddHours($hour)

  return [PSCustomObject]@{
    title = $title
    description = $desc
    sport = $sport
    city = $city.name
    latitude = [math]::Round($city.lat + (Get-Random -Minimum -0.02 -Maximum 0.02), 5)
    longitude = [math]::Round($city.lon + (Get-Random -Minimum -0.02 -Maximum 0.02), 5)
    eventDate = $when.ToString("o")
    skillLevel = $level
    maxParticipants = $max
  }
}

function Invoke-ApiPost($url, $payload) {
  try {
    $json = $payload | ConvertTo-Json -Depth 10
    return Invoke-RestMethod -Method Post -Uri $url -Headers $Headers -Body $json
  }
  catch {
    Write-Warning ("POST failed: " + $_.Exception.Message)
  }
}

for ($i = 1; $i -le $Count; $i++) {
  $ev = New-RandomEvent -i $i
  $res = Invoke-ApiPost "$ApiUrl/api/event" $ev
  if ($res) {
    Write-Host ("Created: {0} ({1}) on {2}" -f $res.title, $res.sport, $res.eventDate) -ForegroundColor Green
  }
  Start-Sleep -Milliseconds 150
}

Write-Host "Event seeding complete." -ForegroundColor Cyan
