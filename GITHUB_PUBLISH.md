# Publishing Repository to GitHub

Step-by-step guide to publish this repository to your GitHub account.

## Prerequisites

- Git installed (`git --version`)
- GitHub account created
- GitHub Personal Access Token (for authentication)

## Step 1: Create GitHub Repository

### Option A: Using GitHub Web UI (Recommended)

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in the details:
   - **Repository name**: `k8s-file-upload-lab` (or your preferred name)
   - **Description**: "Multi-cloud file upload service lab with EKS, GKE, AKS"
   - **Visibility**: Choose **Public** or **Private**
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **"Create repository"**

### Option B: Using GitHub CLI

```bash
# Install GitHub CLI if not installed
# brew install gh  # macOS
# or download from https://cli.github.com/

# Authenticate
gh auth login

# Create repository
gh repo create k8s-file-upload-lab \
  --description "Multi-cloud file upload service lab with EKS, GKE, AKS" \
  --public  # or --private
```

## Step 2: Initialize Git Repository (if not already done)

```bash
cd /Users/weipingli8910/code/playgrounds/k8s-file-upload-lab

# Check if git is already initialized
if [ ! -d .git ]; then
  # Initialize git repository
  git init
  
  # Set default branch to main
  git branch -M main
fi
```

## Step 3: Create .gitignore (if not exists)

```bash
# Check if .gitignore exists
if [ ! -f .gitignore ]; then
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
fi
```

## Step 4: Add All Files

```bash
# Add all files to git
git add .

# Check what will be committed
git status
```

## Step 5: Create Initial Commit

```bash
# Create initial commit
git commit -m "Initial commit: Multi-cloud file upload service lab with Helm charts and CI/CD"
```

## Step 6: Add GitHub Remote

Replace `YOUR_USERNAME` with your GitHub username:

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/k8s-file-upload-lab.git

# Verify remote
git remote -v
```

**Alternative: Using SSH** (if you have SSH keys set up):

```bash
git remote add origin git@github.com:YOUR_USERNAME/k8s-file-upload-lab.git
```

## Step 7: Push to GitHub

```bash
# Push to GitHub
git push -u origin main
```

If prompted for credentials:
- **Username**: Your GitHub username
- **Password**: Use a Personal Access Token (not your GitHub password)

### Create Personal Access Token (if needed)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **"Generate new token (classic)"**
3. Give it a name: "k8s-file-upload-lab"
4. Select scopes: **repo** (full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing

## Step 8: Update Repository URLs

After publishing, update repository URLs in the following files:

### 1. ArgoCD Applications

```bash
# Update file-upload-service application
sed -i '' 's|https://github.com/your-org/k8s-file-upload-lab|https://github.com/YOUR_USERNAME/k8s-file-upload-lab|g' \
  ci-cd/argocd/applications/file-upload-service.yaml

# Update monitoring-stack application
sed -i '' 's|https://github.com/your-org/k8s-file-upload-lab|https://github.com/YOUR_USERNAME/k8s-file-upload-lab|g' \
  ci-cd/argocd/applications/monitoring-stack.yaml

# Update app-of-apps
sed -i '' 's|https://github.com/your-org/k8s-file-upload-lab|https://github.com/YOUR_USERNAME/k8s-file-upload-lab|g' \
  ci-cd/argocd/app-of-apps.yaml
```

### 2. GitHub Actions Workflows (if needed)

The workflows should automatically use the current repository, but verify:

```bash
# Check if any hardcoded URLs exist
grep -r "github.com/your-org" .github/workflows/
```

### 3. Documentation Files

```bash
# Update README if it references the repo
# Update any other documentation files that mention the repository URL
```

## Step 9: Commit and Push Updates

```bash
# Add updated files
git add ci-cd/argocd/

# Commit changes
git commit -m "Update repository URLs in ArgoCD applications"

# Push updates
git push
```

## Step 10: Verify on GitHub

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/k8s-file-upload-lab`
2. Verify all files are present
3. Check that README.md displays correctly
4. Verify folder structure

## Step 11: Set Up GitHub Secrets (for CI/CD)

For GitHub Actions to work, set up secrets:

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add the following secrets:

```
AWS_ACCESS_KEY_ID          # Your AWS access key
AWS_SECRET_ACCESS_KEY      # Your AWS secret key
ECR_URL                    # ECR repository URL (from Terraform output)
S3_BUCKET                  # S3 bucket name (from Terraform output)
IAM_ROLE_ARN              # IAM role ARN (from Terraform output)
```

**Get values from Terraform:**
```bash
cd infrastructure/terraform
terraform output -raw ecr_url
terraform output -raw s3_bucket_name
terraform output -raw file_upload_service_role_arn
```

## Step 12: Enable GitHub Actions

1. Go to repository → **Settings** → **Actions** → **General**
2. Under **"Workflow permissions"**, select:
   - **"Read and write permissions"**
   - **"Allow GitHub Actions to create and approve pull requests"**
3. Click **"Save"**

## Quick Reference Commands

```bash
# Initialize and push (if starting fresh)
cd /Users/weipingli8910/code/playgrounds/k8s-file-upload-lab
git init
git branch -M main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/k8s-file-upload-lab.git
git push -u origin main

# Update and push changes
git add .
git commit -m "Your commit message"
git push

# Check status
git status
git remote -v
git log --oneline
```

## Troubleshooting

### Authentication Issues

**Problem**: `fatal: Authentication failed`

**Solution**: Use Personal Access Token instead of password
1. Create token (see Step 7)
2. Use token as password when pushing

### Remote Already Exists

**Problem**: `fatal: remote origin already exists`

**Solution**:
```bash
# Remove existing remote
git remote remove origin

# Add new remote
git remote add origin https://github.com/YOUR_USERNAME/k8s-file-upload-lab.git
```

### Push Rejected

**Problem**: `! [rejected] main -> main (fetch first)`

**Solution**:
```bash
# Pull first (if repository was initialized on GitHub)
git pull origin main --allow-unrelated-histories

# Then push
git push -u origin main
```

### Large Files

**Problem**: Files too large for GitHub

**Solution**: Use Git LFS or exclude large files
```bash
# Install Git LFS
brew install git-lfs  # macOS

# Track large files
git lfs track "*.zip"
git lfs track "*.tar.gz"

# Add .gitattributes
git add .gitattributes
```

## Next Steps

After publishing:

1. ✅ **Update repository URLs** in ArgoCD applications
2. ✅ **Set up GitHub Secrets** for CI/CD
3. ✅ **Enable GitHub Actions**
4. ✅ **Test CI pipeline** by pushing a commit
5. ✅ **Set up branch protection** (optional, for production)
6. ✅ **Add collaborators** (if working in a team)

## Branch Protection (Optional)

For production repositories:

1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Include administrators

## Repository Settings

Recommended settings:

1. **Settings** → **General**:
   - Enable **Issues**
   - Enable **Projects**
   - Enable **Wiki** (optional)

2. **Settings** → **Pages** (if you want GitHub Pages):
   - Source: Deploy from a branch
   - Branch: `main` / `docs`

3. **Settings** → **Actions**:
   - Enable Actions
   - Set workflow permissions

## Verification Checklist

- [ ] Repository created on GitHub
- [ ] All files pushed successfully
- [ ] README.md displays correctly
- [ ] Repository URLs updated in ArgoCD applications
- [ ] GitHub Secrets configured
- [ ] GitHub Actions enabled
- [ ] CI pipeline tested (push a commit)

## Additional Resources

- [GitHub Documentation](https://docs.github.com/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

