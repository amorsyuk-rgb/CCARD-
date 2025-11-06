GraceWise v5.8 Full Functional Fix
---------------------------------
This package restores full Cards/Transactions/Grace/Settings pages and keeps the secure email-auth system.
- server.js: register/login/forgot/reset + sync/restore (no Face endpoints)
- public/: login, forgot, cards, transactions, grace, settings, core.js, theme.css
- data/db.json initial
Notes:
- Auto-backup (syncToServer) is triggered automatically after login/register.
- Settings page includes manual Backup, Restore, and Download Data File.
- To deploy on Render: upload repo, set JWT_SECRET env var, and deploy. No shell required.
