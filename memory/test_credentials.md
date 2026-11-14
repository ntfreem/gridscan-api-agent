# Test Credentials

## Admin Account
- **Username**: administrator
- **Password**: Admin@123
- **Email**: admin@bridgebot.tech
- **Role**: superadmin

## Test User (created via invite flow)
- **Username**: johndoe
- **Password**: Reset@456 (was reset by admin)
- **Email**: johndoe@example.com
- **Role**: user

## Login Notes
- Login endpoint: POST /api/auth/login
- Field name: `email_or_username` (accepts either email or username)
- Response field: `token` (not `access_token`)
