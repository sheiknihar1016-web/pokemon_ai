$git = "C:\Users\muthu\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe"
$env:PATH = "C:\Users\muthu\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd;C:\Users\muthu\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\mingw64\bin;" + $env:PATH
$env:GIT_TERMINAL_PROMPT = "1"
Set-Location "d:\Documents\New folder\nihar\project"
& $git config credential.helper wincred
Write-Host "Pushing to GitHub - A login popup will appear..." -ForegroundColor Green
& $git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS! Pushed to https://github.com/sheiknihar1016-web/pokemon_ai" -ForegroundColor Green
} else {
    Write-Host "`nTry pasting your GitHub token when prompted for password." -ForegroundColor Yellow
}
Read-Host "Press Enter to close"
