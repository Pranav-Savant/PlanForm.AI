#!/bin/bash

# PlanForm.AI - Stellar Smart Contract Deployment Script
# This script builds and deploys the Blueprint Registry contract to Stellar Testnet

set -e

echo "🚀 PlanForm.AI Smart Contract Deployment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v rustc &> /dev/null; then
        echo -e "${RED}❌ Rust is not installed. Install from https://rustup.rs${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Rust installed${NC}"
    
    if ! command -v stellar &> /dev/null; then
        echo -e "${RED}❌ Stellar CLI is not installed. Run: cargo install --locked stellar-cli${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Stellar CLI installed${NC}"
    
    if ! rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
        echo -e "${YELLOW}Adding wasm32 target...${NC}"
        rustup target add wasm32-unknown-unknown
    fi
    echo -e "${GREEN}✓ WASM target available${NC}"
}

# Build contract
build_contract() {
    echo -e "\n${YELLOW}Building smart contract...${NC}"
    
    cd smart-contract
    
    cargo build --target wasm32-unknown-unknown --release
    
    if [ -f "target/wasm32-unknown-unknown/release/blueprint_registry.wasm" ]; then
        echo -e "${GREEN}✓ Contract built successfully${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    
    cd ..
}

# Generate keypair if needed
setup_account() {
    echo -e "\n${YELLOW}Setting up deployment account...${NC}"
    
    if [ ! -f ".stellar/identity/deployer.toml" ]; then
        echo "Creating new deployer identity..."
        stellar keys generate deployer --network testnet
        
        echo -e "${YELLOW}Funding account with Friendbot...${NC}"
        PUBLIC_KEY=$(stellar keys address deployer)
        curl -s "https://friendbot.stellar.org?addr=$PUBLIC_KEY" > /dev/null
        echo -e "${GREEN}✓ Account funded${NC}"
    fi
    
    PUBLIC_KEY=$(stellar keys address deployer)
    echo -e "${GREEN}✓ Deployer address: $PUBLIC_KEY${NC}"
}

# Deploy contract
deploy_contract() {
    echo -e "\n${YELLOW}Deploying to Stellar Testnet...${NC}"
    
    CONTRACT_ID=$(stellar contract deploy \
        --wasm smart-contract/target/wasm32-unknown-unknown/release/blueprint_registry.wasm \
        --source deployer \
        --network testnet)
    
    if [ -z "$CONTRACT_ID" ]; then
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Contract deployed!${NC}"
    echo -e "${GREEN}Contract ID: $CONTRACT_ID${NC}"
    
    # Save contract ID to .env files
    echo "VITE_CONTRACT_ID=$CONTRACT_ID" > client/.env
    echo -e "${GREEN}✓ Contract ID saved to client/.env${NC}"
    
    # Initialize contract
    echo -e "\n${YELLOW}Initializing contract...${NC}"
    stellar contract invoke \
        --id $CONTRACT_ID \
        --source deployer \
        --network testnet \
        -- \
        initialize
    
    echo -e "${GREEN}✓ Contract initialized${NC}"
}

# Print summary
print_summary() {
    echo -e "\n========================================="
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo "========================================="
    echo ""
    echo "Contract ID: $CONTRACT_ID"
    echo ""
    echo "View on Block Explorer:"
    echo "https://lab.stellar.org/explorer/testnet/contract/$CONTRACT_ID"
    echo ""
    echo "Next steps:"
    echo "1. Update README.md with your Contract ID"
    echo "2. Take a screenshot of the block explorer"
    echo "3. Run 'npm run dev' in client/ to test the integration"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    build_contract
    setup_account
    deploy_contract
    print_summary
}

main
