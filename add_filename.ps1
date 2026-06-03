# Script para añadir nombre de archivo en TODAS las subcarpetas
$extensions = @('.py', '.jsx', '.js', '.css', '.html')

# Función para procesar cada archivo
function Add-FilenameToFile {
    param($filePath)
    
    $extension = [System.IO.Path]::GetExtension($filePath)
    $fileName = [System.IO.Path]::GetFileName($filePath)
    $relativePath = Resolve-Path -Path $filePath -Relative
    
    try {
        # Leer el contenido del archivo
        $content = Get-Content -Path $filePath -Raw -ErrorAction Stop
        
        # Verificar si ya existe el nombre en la primera línea
        $firstLine = ($content -split "`r`n")[0]
        if ($firstLine -match [regex]::Escape($fileName)) {
            Write-Host "[OK] $relativePath - Ya contiene el nombre" -ForegroundColor Gray
            return $true
        }
        
        # Añadir comentario según extensión
        switch ($extension) {
            '.py'   { $comment = "# $fileName`r`n" }
            '.js'   { $comment = "// $fileName`r`n" }
            '.jsx'  { $comment = "// $fileName`r`n" }
            '.css'  { $comment = "/* $fileName */`r`n" }
            '.html' { $comment = "<!-- $fileName -->`r`n" }
            default { 
                Write-Host "[SKIP] $relativePath - Extensión no soportada" -ForegroundColor Yellow
                return $false
            }
        }
        
        # Guardar el archivo con el comentario al inicio
        $newContent = $comment + $content
        Set-Content -Path $filePath -Value $newContent -NoNewline -Encoding UTF8
        Write-Host "[ADDED] $relativePath" -ForegroundColor Green
        return $true
        
    } catch {
        Write-Host "[ERROR] $relativePath : $_" -ForegroundColor Red
        return $false
    }
}

# Procesar todos los archivos en el directorio actual y subcarpetas
Write-Host ""
Write-Host "Buscando archivos en: $(Get-Location)" -ForegroundColor Cyan
Write-Host "(Incluyendo subcarpetas)" -ForegroundColor Cyan
Write-Host ""

# Obtener todos los archivos recursivamente
$files = Get-ChildItem -Path . -File -Recurse | Where-Object { $_.Extension -in $extensions }

if ($files.Count -eq 0) {
    Write-Host "No se encontraron archivos con extensiones: $($extensions -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "Encontrados $($files.Count) archivos para procesar:" -ForegroundColor Cyan
    Write-Host ""
    
    $count = 0
    foreach ($file in $files) {
        if (Add-FilenameToFile $file.FullName) {
            $count++
        }
    }
    
    Write-Host ""
    Write-Host "Procesados: $count de $($files.Count) archivos" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Script finalizado" -ForegroundColor Cyan