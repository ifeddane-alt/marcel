# Comptes de test MARCEL (vérifiés le 2026-06 via /api/auth/login)

## Tenant Altair (principal)
- admin@altair.fr / Admin2026!        → TENANT_ADMIN (accès complet, admin)
- cp@altair.fr / Altair2026!          → PMO_USER (chef de projet)
- manager@altair.fr / Altair2026!     → PMO_USER (manager portfolio)
- pmo@altair.fr / Pmo1234!            → PMO_USER
- viewer@altair.fr / View1234!        → READ_ONLY
- user@altair.fr / Altair2026!        → READ_ONLY (contributeur)
- achats@altair.fr / Altair2026!      → READ_ONLY (profil Achats)
- test.audit@altair.fr / MonCompte2026! → READ_ONLY (créé via POST /api/admin/users pour tests gestion utilisateurs ; mdp modifié via /api/auth/change-password)

## Tenant Beta Corp (second tenant, isolation)
- admin@betacorp.fr / Beta2026!
- pm@betacorp.fr / PM2026!

## Endpoints auth
- POST /api/auth/login {email, password} → {access_token, user, permissions}
- GET /api/auth/me (Bearer)
- Gestion utilisateurs (admin) : GET/POST /api/admin/users, PATCH /api/admin/users/{id} (profile_id, name, is_active), POST /api/admin/users/{id}/reset-password {password}
