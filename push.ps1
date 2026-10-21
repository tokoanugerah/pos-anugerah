param(
    [string]$message = "update: sinkronisasi otomatis kode sistem pos anugerah store"
)

Write-Host "Menyimpan seluruh perubahan ke git..." -ForegroundColor Cyan
git add .

$status = git status --porcelain
if ($status) {
    git commit -m "$message"
    Write-Host "Commit berhasil dibuat: $message" -ForegroundColor Green
} else {
    Write-Host "Tidak ada perubahan berkas baru untuk di-commit." -ForegroundColor Yellow
}

Write-Host "Mendorong perubahan ke remote GitHub (tokoanugerah/pos-anugerah)..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Berhasil di-push ke GitHub!" -ForegroundColor Green
} else {
    Write-Host "Gagal push. Periksa kembali koneksi atau remote GitHub Anda." -ForegroundColor Red
}
