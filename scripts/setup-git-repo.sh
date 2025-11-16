#!/bin/bash
set -e

echo "Setting up Git repository for GitHub..."

# Get repository name from user or use default
read -p "Enter your GitHub username: " GITHUB_USERNAME
read -p "Enter repository name [k8s-file-upload-lab]: " REPO_NAME
REPO_NAME=${REPO_NAME:-k8s-file-upload-lab}

# Check if git is initialized
if [ ! -d .git ]; then
    echo "Initializing Git repository..."
    git init
    git branch -M main
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already initialized"
fi

# Check if .gitignore exists
if [ ! -f .gitignore ]; then
    echo "Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Terraform
*.tfstate
*.tfstate.*
.terraform/
.terraform.lock.hcl
*.tfvars
!*.tfvars.example

# Environment files
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Node modules
node_modules/
npm-debug.log*

# Build artifacts
dist/
build/

# Helm
charts/*/charts/
*.tgz

# Kubernetes
kubeconfig
*.kubeconfig

# Secrets
secrets/
*.pem
*.key
*.crt

# Temporary files
tmp/
temp/
EOF
    echo "✅ .gitignore created"
else
    echo "✅ .gitignore already exists"
fi

# Add all files
echo "Adding files to Git..."
git add .

# Check if remote exists
if git remote get-url origin &>/dev/null; then
    echo "Remote 'origin' already exists: $(git remote get-url origin)"
    read -p "Do you want to update it? (y/n): " UPDATE_REMOTE
    if [ "$UPDATE_REMOTE" = "y" ]; then
        git remote set-url origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git
        echo "✅ Remote updated"
    fi
else
    echo "Adding remote..."
    git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git
    echo "✅ Remote added"
fi

# Show status
echo ""
echo "Git status:"
git status --short | head -20

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create repository on GitHub: https://github.com/new"
echo "   - Name: $REPO_NAME"
echo "   - DO NOT initialize with README, .gitignore, or license"
echo ""
echo "2. Commit and push:"
echo "   git commit -m 'Initial commit: Multi-cloud file upload service lab'"
echo "   git push -u origin main"
echo ""
echo "3. Update repository URLs in ArgoCD applications:"
echo "   sed -i '' 's|your-org|$GITHUB_USERNAME|g' ci-cd/argocd/applications/*.yaml"
echo "   sed -i '' 's|your-org|$GITHUB_USERNAME|g' ci-cd/argocd/app-of-apps.yaml"
echo ""
echo "4. Set up GitHub Secrets (see GITHUB_PUBLISH.md)"

