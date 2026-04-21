# 🛡️ Production Recovery Guide

If the dashboard UI or logic breaks during development, use this file to restore the "Clean Baseline."

## RECOVERY POINT: v1391
*   **Commit**: `20abb76`
*   **Git Tag**: `RECOVERY_BASELINE_V1391`
*   **Status**: Confirmed Stable (7:18 PM 4/21)

## Restore Instructions:
```powershell
git fetch origin
git reset --hard RECOVERY_BASELINE_V1391
git push --force origin main
```
