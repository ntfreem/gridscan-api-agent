# BitBot Pro Test Credentials

## IMPORTANT
The old credentials (admin@bitbotpro.io / x7K$mP2vL9nQ) are NOT valid for the current production API at api.bitbotpro.io.
Do not use or retain those credentials.

## Production API (api.bitbotpro.io)
- Awaiting dedicated frontend-testing account from user (via Claude Code).
- Login endpoint: POST /api/auth/login
- Session: httpOnly cookie (no localStorage)

## Preview Proxy
- Backend at port 8001 is a reverse proxy to https://api.bitbotpro.io
- All /api/* requests are forwarded with cookies and CSRF headers preserved
