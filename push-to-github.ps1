# Quick Push to GitHub Script
# Save this as push-to-github.ps1 and run it after creating your GitHub repo

Write-Host "🚀 Password Migration Tool - GitHub Upload Script" -ForegroundColor Cyan
Write-Host ""

# Get GitHub username
$username = Read-Host "Enter your GitHub username"

# Get repository name
Write-Host ""
Write-Host "Suggested repository names:" -ForegroundColor Yellow
Write-Host "  1. password-migration-tool (recommended)"
Write-Host "  2. bitwarden-to-protonpass"
Write-Host "  3. chatpass"
Write-Host ""
$repoName = Read-Host "Enter repository name (or press Enter for 'password-migration-tool')"

if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "password-migration-tool"
}

Write-Host ""
Write-Host "📍 Repository will be: https://github.com/$username/$repoName" -ForegroundColor Green
Write-Host ""
$confirm = Read-Host "Is this correct? (y/n)"

if ($confirm -ne 'y') {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "⚠️  IMPORTANT: Make sure you've created the repository on GitHub first!" -ForegroundColor Yellow
Write-Host "   Go to: https://github.com/new" -ForegroundColor Yellow
Write-Host ""
$created = Read-Host "Have you created the repository on GitHub? (y/n)"

if ($created -ne 'y') {
    Write-Host ""
    Write-Host "Please create the repository first, then run this script again." -ForegroundColor Yellow
    Start-Process "https://github.com/new"
    exit
}

Write-Host ""
Write-Host "🔄 Setting up remote and pushing..." -ForegroundColor Cyan

try {
    # Change to project directory
    Set-Location "c:\Users\Gaming\Downloads\chatpass"
    
    # Add remote
    git remote add origin "https://github.com/$username/$repoName.git" 2>&1 | Out-Null
    
    # Rename branch to main
    git branch -M main
    
    # Push to GitHub
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    git push -u origin main
    
    Write-Host ""
    Write-Host "✅ SUCCESS! Your project is now on GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 View your repository:" -ForegroundColor Cyan
    Write-Host "   https://github.com/$username/$repoName" -ForegroundColor Blue
    Write-Host ""
    Write-Host "📖 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Add topics to your repo (password-manager, bitwarden, security)"
    Write-Host "   2. Enable GitHub Pages if you want to host it online"
    Write-Host "   3. Star your own repo 😊"
    Write-Host ""
    
    # Open repository in browser
    $openBrowser = Read-Host "Open repository in browser? (y/n)"
    if ($openBrowser -eq 'y') {
        Start-Process "https://github.com/$username/$repoName"
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "If the remote already exists, remove it with:" -ForegroundColor Yellow
    Write-Host "   git remote remove origin" -ForegroundColor Gray
    Write-Host "Then run this script again." -ForegroundColor Yellow
}
