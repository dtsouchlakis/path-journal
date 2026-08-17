$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceRoot = Join-Path $projectRoot 'android\app\src\main\res'
$cobalt = [System.Drawing.ColorTranslator]::FromHtml('#3157D5')
$sky = [System.Drawing.ColorTranslator]::FromHtml('#DCE9FF')
$gold = [System.Drawing.ColorTranslator]::FromHtml('#D69B49')

function New-Canvas([int]$width, [int]$height, [bool]$transparent) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($(if ($transparent) { [System.Drawing.Color]::Transparent } else { $sky }))
    return [PSCustomObject]@{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-Daymark([System.Drawing.Graphics]$graphics, [float]$centerX, [float]$centerY, [float]$scale) {
    $sunBrush = New-Object System.Drawing.SolidBrush($gold)
    $horizonPen = New-Object System.Drawing.Pen($cobalt, [float]($scale * 0.075))
    $horizonPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $horizonPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    try {
        $sunSize = $scale * 0.20
        $graphics.FillEllipse($sunBrush, $centerX - ($sunSize / 2), $centerY - ($scale * 0.30), $sunSize, $sunSize)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        try {
            $path.AddBezier($centerX - ($scale * 0.31), $centerY,
                $centerX - ($scale * 0.23), $centerY + ($scale * 0.30),
                $centerX + ($scale * 0.23), $centerY + ($scale * 0.30),
                $centerX + ($scale * 0.31), $centerY)
            $graphics.DrawPath($horizonPen, $path)
        } finally { $path.Dispose() }
    } finally {
        $sunBrush.Dispose()
        $horizonPen.Dispose()
    }
}

function Save-Icon([string]$path, [int]$size, [bool]$transparent) {
    $canvas = New-Canvas $size $size $transparent
    try {
        Draw-Daymark $canvas.Graphics ($size / 2) ($size / 2) ($size * 0.58)
        $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $canvas.Graphics.Dispose()
        $canvas.Bitmap.Dispose()
    }
}

function Save-Splash([string]$path) {
    $existing = [System.Drawing.Image]::FromFile($path)
    try { $width = $existing.Width; $height = $existing.Height } finally { $existing.Dispose() }
    $canvas = New-Canvas $width $height $false
    try {
        Draw-Daymark $canvas.Graphics ($width / 2) ($height / 2) ([Math]::Min($width, $height) * 0.18)
        $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $canvas.Graphics.Dispose()
        $canvas.Bitmap.Dispose()
    }
}

$densities = @{
    'mdpi' = @{ Legacy = 48; Foreground = 108 }
    'hdpi' = @{ Legacy = 72; Foreground = 162 }
    'xhdpi' = @{ Legacy = 96; Foreground = 216 }
    'xxhdpi' = @{ Legacy = 144; Foreground = 324 }
    'xxxhdpi' = @{ Legacy = 192; Foreground = 432 }
}

foreach ($density in $densities.Keys) {
    $folder = Join-Path $resourceRoot "mipmap-$density"
    Save-Icon (Join-Path $folder 'ic_launcher.png') $densities[$density].Legacy $false
    Save-Icon (Join-Path $folder 'ic_launcher_round.png') $densities[$density].Legacy $false
    Save-Icon (Join-Path $folder 'ic_launcher_foreground.png') $densities[$density].Foreground $true
}

Get-ChildItem -Path $resourceRoot -Recurse -Filter 'splash.png' | ForEach-Object { Save-Splash $_.FullName }
Save-Icon (Join-Path $projectRoot 'public\app-icon-512.png') 512 $false
