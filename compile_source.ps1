$outputFile = "C:\Users\eduar\Desktop\bakery_full_source_code.txt"
$sourceDir = "C:\Users\eduar\Desktop\Bakery 2.5\src"

# Crear encabezado
$header = @"
================================================================================
BAKERY 2.5 - CÓDIGO FUENTE COMPLETO
================================================================================
Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Total de archivos incluidos: TypeScript (.ts) y TypeScript React (.tsx)
================================================================================

"@

$header | Out-File -FilePath $outputFile -Encoding UTF8

# Obtener todos los archivos .ts y .tsx
$files = Get-ChildItem -Path $sourceDir -Recurse -Include *.tsx,*.ts -Exclude *.test.*,*.spec.* | Sort-Object FullName

Write-Host "Procesando $($files.Count) archivos..."

$counter = 0
foreach ($file in $files) {
    $counter++
    $relativePath = $file.FullName.Replace("C:\Users\eduar\Desktop\Bakery 2.5\", "")
    
    Write-Host "[$counter/$($files.Count)] $relativePath"
    
    # Agregar separador y nombre de archivo
    $separator = "`r`n" + ("=" * 80) + "`r`n"
    $separator += "ARCHIVO: $relativePath`r`n"
    $separator += ("=" * 80) + "`r`n`r`n"
    
    $separator | Out-File -FilePath $outputFile -Append -Encoding UTF8
    
    # Agregar contenido del archivo
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $content | Out-File -FilePath $outputFile -Append -Encoding UTF8 -NoNewline
    } catch {
        "// Error al leer archivo: $_" | Out-File -FilePath $outputFile -Append -Encoding UTF8
    }
    
    # Agregar separación entre archivos
    "`r`n`r`n" | Out-File -FilePath $outputFile -Append -Encoding UTF8
}

Write-Host "`nArchivo creado exitosamente: $outputFile"
Write-Host "Tamaño: $([math]::Round((Get-Item $outputFile).Length / 1MB, 2)) MB"
