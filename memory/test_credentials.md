# BridgeBot Test Credentials

## Admin Account
- Username: `administrator`
- Password: `Admin@123`

## Login Endpoint
- POST `/api/auth/login`
- Body: `{"email_or_username": "administrator", "password": "Admin@123"}`

## Instance ID
- Fetch via: GET `/api/admin/instances` (with Bearer token)
- Current preview instance: `88bfae82-2533-4235-968d-b3298fd57073` (may change)

## Notes
- Integration endpoints require `X-Instance-ID` header (frontend adds automatically from localStorage)
- LLM provider defaults to "emergent" (Emergent Universal Key)
