# PlanForm.AI - Stellar Smart Contract Deployment Script (Windows)
# This script builds and deploys the Blueprint Registry contract to Stellar Testnet

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 PlanForm.AI Smart Contract Deployment" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Check prerequisites
function Check-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor Yellow
    
    # Check Rust
    try {
        $rustVersion = rustc --version
        Write-Host "✓ Rust installed: $rustVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Rust is not installed. Install from https://rustup.rs" -ForegroundColor Red
        exit 1
    }
    
    # Check Stellar CLI
    try {
        $stellarVersion = stellar --version
        Write-Host "✓ Stellar CLI installed" -ForegroundColor Green
    } catch {
        Write-Host "❌ Stellar CLI is not installed." -ForegroundColor Red
        Write-Host "Run: cargo install --locked stellar-cli" -ForegroundColor Yellow
        exit 1
    }
    
    # Add WASM target if needed
    $targets = rustup target list
    if ($targets -notcontains "wasm32-unknown-unknown (installed)") {
        Write-Host "Adding wasm32 target..." -ForegroundColor Yellow
        rustup target add wasm32-unknown-unknown
    }
    Write-Host "✓ WASM target available" -ForegroundColor Green
}

# Build contract
function Build-Contract {
    Write-Host "`nBuilding smart contract..." -ForegroundColor Yellow
    
    Push-Location smart-contract
    
    cargo build --target wasm32-unknown-unknown --release
    
    $wasmPath = "target\wasm32-unknown-unknown\release\blueprint_registry.wasm"
    if (Test-Path $wasmPath) {
        Write-Host "✓ Contract built successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed - WASM file not found" -ForegroundColor Red
        exit 1
    }
    
    Pop-Location
}

# Setup deployment account
function Setup-Account {
    Write-Host "`nSetting up deployment account..." -ForegroundColor Yellow
    
    # Check if identity exists
    $identityExists = stellar keys address deployer 2>$null
    
    if (-not $identityExists) {
        Write-Host "Creating new deployer identity..." -ForegroundColor Yellow
        stellar keys generate deployer --network testnet
        
        Write-Host "Funding account with Friendbot..." -ForegroundColor Yellow
        $publicKey = stellar keys address deployer
        Invoke-RestMethod -Uri "https://friendbot.stellar.org?addr=$publicKey" | Out-Null
        Write-Host "✓ Account funded" -ForegroundColor Green
    }
    
    $global:PublicKey = stellar keys address deployer
    Write-Host "✓ Deployer address: $global:PublicKey" -ForegroundColor Green
}

# Deploy contract
function Deploy-Contract {
    Write-Host "`nDeploying to Stellar Testnet..." -ForegroundColor Yellow
    
    $wasmPath = "smart-contract\target\wasm32-unknown-unknown\release\blueprint_registry.wasm"
    
    $global:ContractId = stellar contract deploy `
        --wasm $wasmPath `
        --source deployer `
        --network testnet
    
    if (-not $global:ContractId) {
        Write-Host "❌ Deployment failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Contract deployed!" -ForegroundColor Green
    Write-Host "Contract ID: $global:ContractId" -ForegroundColor Cyan
    
    # Save contract ID to .env
    "VITE_CONTRACT_ID=$global:ContractId" | Out-File -FilePath "client\.env" -Encoding utf8
    Write-Host "✓ Contract ID saved to client\.env" -ForegroundColor Green
    
    # Initialize contract
    Write-Host "`nInitializing contract..." -ForegroundColor Yellow
    stellar contract invoke `
        --id $global:ContractId `
        --source deployer `
        --network testnet `
        -- `
        initialize
    
    Write-Host "✓ Contract initialized" -ForegroundColor Green
}

# Print summary
function Print-Summary {
    Write-Host "`n=========================================" -ForegroundColor Cyan
    Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
    Write-Host "=========================================`n" -ForegroundColor Cyan
    
    Write-Host "Contract ID: $global:ContractId" -ForegroundColor White
    Write-Host ""
    Write-Host "View on Block Explorer:" -ForegroundColor Yellow
    Write-Host "https://lab.stellar.org/explorer/testnet/contract/$global:ContractId" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update README.md with your Contract ID"
    Write-Host "2. Take a screenshot of the block explorer"
    Write-Host "3. Run 'npm run dev' in client/ to test the integration"
    Write-Host ""
}

# Main execution
try {
    Check-Prerequisites
    Build-Contract
    Setup-Account
    Deploy-Contract
    Print-Summary
} catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    exit 1
}
