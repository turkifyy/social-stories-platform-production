# GitHub Actions Secrets - Quick Setup Guide

## ⚡ Quick Setup (2 minutes)

### Step 1: Copy Your Secrets
Open your Replit project and copy these values from "Secrets" tab:
- `CRON_SECRET_KEY` - Your secret key for authentication

Your Replit URL example: `https://story-scheduler-username.replit.dev`

### Step 2: Add to GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Add these 2 secrets:

| Name | Value | Example |
|------|-------|---------|
| `REPLIT_APP_URL` | Your Replit app URL | `https://story-scheduler-username.replit.dev` |
| `CRON_SECRET_KEY` | Your cron secret from Replit | `a1b2c3d4e5f6...` |

### Step 3: Verify

Run workflow manually:
1. Go to **GitHub → Actions → Auto-Publish Stories**
2. Click **"Run workflow"**
3. Select **"Run workflow"**
4. Check logs - should show **✅ Success**

## 🔐 Secret Security

- ✅ Secrets are **encrypted** in GitHub
- ✅ Secrets are **not visible** in logs
- ✅ Use **same secret** in both GitHub and Replit
- ✅ Change secret anytime by updating both places

## 🗑️ How to Remove GitHub Actions

If you want to disable auto-publishing:

**Option 1: Disable workflow**
1. GitHub → Actions → Auto-Publish Stories
2. Click "..." menu → Disable workflow

**Option 2: Delete workflow file**
1. Delete `.github/workflows/auto-publish.yml`
2. Push to main branch

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow says "secret is not set" | Add secrets to GitHub (see Step 2) |
| HTTP 401 error | Secrets don't match - verify both places have same key |
| HTTP 500 error | Check Replit logs - may need linked accounts |
| Workflow doesn't run at 6 AM UTC | GitHub sometimes runs 1-5 minutes late (normal) |

---

Need more help? See `GITHUB_ACTIONS_SETUP.md` for detailed guide.
