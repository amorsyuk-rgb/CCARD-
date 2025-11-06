GraceWise v5.7 Hybrid - deploy on Render. Set JWT_SECRET env var. Place face-api models in public/models/ if using face login.
GraceWise v5.7.2 Secure Hybrid
------------------------------

Fix: Each user’s local data (banks, transactions, theme) is now isolated by user ID.

Usage:
1. Replace /public/core.js with this version.
2. Redeploy or reload Render app.
3. Each login gets its own storage keys:
     gw_banks_<userID>
     gw_tx_<userID>
     gw_theme_<userID>
4. Cloud backup & restore already respect user identity.

Logout automatically clears that user’s local data.
