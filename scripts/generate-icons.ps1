$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceRoot = Join-Path $projectRoot 'android\app\src\main\res'
$orange = [System.Drawing.ColorTranslator]::FromHtml('#FF7A00')
$cream = [System.Drawing.ColorTranslator]::FromHtml('#FFF7EF')

function New-Canvas([int]$width, [int]$height, [bool]$transparent) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    if ($transparent) {
        $graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
        $graphics.Clear($cream)
    }
    return [PSCustomObject]@{
        Bitmap = $bitmap
        Graphics = $graphics
    }
}

function Draw-Flower([System.Drawing.Graphics]$graphics, [float]$centerX, [float]$centerY, [float]$scale) {
    $brush = New-Object System.Drawing.SolidBrush($orange)
    try {
        for ($index = 0; $index -lt 5; $index++) {
            $state = $graphics.Save()
            $graphics.TranslateTransform($centerX, $centerY)
            $graphics.RotateTransform($index * 72)
            $petal = [System.Drawing.RectangleF]::new(
                [float](-0.105 * $scale),
                [float](-0.45 * $scale),
                [float](0.21 * $scale),
                [float](0.36 * $scale)
            )
            $graphics.FillEllipse($brush, $petal)
            $graphics.Restore($state)
        }
        $graphics.FillEllipse($brush, $centerX - (0.08 * $scale), $centerY - (0.08 * $scale), 0.16 * $scale, 0.16 * $scale)
    } finally {
        $brush.Dispose()
    }
}

function Save-LegacyIcon([string]$path, [int]$size, [bool]$round) {
    $canvas = New-Canvas $size $size $round
    $bitmap = $canvas.Bitmap
    $graphics = $canvas.Graphics
    try {
        if ($round) {
            $backgroundBrush = New-Object System.Drawing.SolidBrush($cream)
            try { $graphics.FillEllipse($backgroundBrush, 0, 0, $size - 1, $size - 1) } finally { $backgroundBrush.Dispose() }
        }
        Draw-Flower $graphics ($size / 2) ($size / 2) ($size * 0.56)
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Save-Foreground([string]$path, [int]$size) {
    $canvas = New-Canvas $size $size $true
    $bitmap = $canvas.Bitmap
    $graphics = $canvas.Graphics
    try {
        Draw-Flower $graphics ($size / 2) ($size / 2) ($size * 0.46)
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Save-Splash([string]$path) {
    $existing = [System.Drawing.Image]::FromFile($path)
    try {
        $width = $existing.Width
        $height = $existing.Height
    } finally {
        $existing.Dispose()
    }
    $canvas = New-Canvas $width $height $false
    $bitmap = $canvas.Bitmap
    $graphics = $canvas.Graphics
    try {
        $flowerSize = [Math]::Min($width, $height) * 0.17
        Draw-Flower $graphics ($width / 2) ($height / 2) $flowerSize
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
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
    Save-LegacyIcon (Join-Path $folder 'ic_launcher.png') $densities[$density].Legacy $false
    Save-LegacyIcon (Join-Path $folder 'ic_launcher_round.png') $densities[$density].Legacy $true
    Save-Foreground (Join-Path $folder 'ic_launcher_foreground.png') $densities[$density].Foreground
}

Get-ChildItem -Path $resourceRoot -Recurse -Filter 'splash.png' | ForEach-Object {
    Save-Splash $_.FullName
}

Save-LegacyIcon (Join-Path $projectRoot 'public\app-icon-512.png') 512 $false
