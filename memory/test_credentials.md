# Test Credentials

## Admin Account
- **Login field**: email_or_username
- **Username**: administrator
- **Email**: admin@bridgebot.tech
- **Password**: Admin@123
- **Role**: superadmin

## Instance
- **Name**: API Tester
- **ID**: 88bfae82-2533-4235-968d-b3298fd57073

## App URL
- **Preview**: https://rag-search-dev.preview.emergentagent.com
- **API Base**: https://rag-search-dev.preview.emergentagent.com/api

## Auth Notes
- Frontend stores JWT as `bf_token` in localStorage
- Instance stored as `bf_instance_id` in localStorage
- API requests use `Authorization: Bearer <token>` + `X-Instance-ID: <id>` headers
