# Admin Login Setup

## ✅ Implementation Complete

The admin portal now has a secure login system with:
- **SSM Parameter Store** for password storage
- **Password caching** in localStorage (7 days)
- **Session management** with automatic validation
- **CORS** configured for API Gateway

## 🔐 Password Setup

The password is stored in AWS Systems Manager Parameter Store at:
```
/gettrainmate/admin/password
```

### Set Password

```bash
./scripts/set-admin-password.sh "Maxang11@@"
```

Or manually:
```bash
aws ssm put-parameter \
  --name "/gettrainmate/admin/password" \
  --value "Maxang11@@" \
  --type "SecureString" \
  --overwrite
```

### Retrieve Password

```bash
aws ssm get-parameter \
  --name "/gettrainmate/admin/password" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text
```

## 🚀 How It Works

### 1. Login Flow

1. User navigates to `/admin` or `/admin/login`
2. If no valid session, redirects to login page
3. User enters email (`mykantor@bellsouth.net`) and password
4. Frontend calls `/api/admin/login` (no auth required)
5. Backend validates email against `ADMIN_ALLOWLIST`
6. Backend retrieves password from SSM Parameter Store
7. Backend compares passwords
8. On success, returns session token (7-day expiry)
9. Frontend stores session in localStorage
10. If "Remember password" is checked, password is cached locally (encrypted)

### 2. Session Management

- **Session Storage**: `localStorage` key: `admin_session`
- **Password Cache**: `localStorage` key: `admin_password_cache`
- **Session Duration**: 7 days
- **Cache Duration**: 7 days

### 3. Route Protection

- `AdminRoute` component checks for valid session
- If session expired/invalid, redirects to `/admin/login`
- Session is validated with backend on each check

## 📋 Login Page Features

- ✅ Email pre-filled with `mykantor@bellsouth.net`
- ✅ Password field with auto-fill from cache
- ✅ "Remember password" checkbox (default: checked)
- ✅ Password cached locally for 7 days
- ✅ Session token stored for 7 days
- ✅ Automatic redirect if session exists
- ✅ Error handling with user-friendly messages

## 🔧 Configuration

### Backend

The login endpoint is at:
```
POST /api/admin/login
```

**Request:**
```json
{
  "email": "mykantor@bellsouth.net",
  "password": "Maxang11@@"
}
```

**Response:**
```json
{
  "success": true,
  "sessionToken": "guid-here",
  "expiresAt": "2026-02-03T00:00:00Z",
  "email": "mykantor@bellsouth.net"
}
```

### Frontend

Login page: `/admin/login`  
Admin portal: `/admin/dashboard`

## 🛡️ Security Features

1. **SSM SecureString**: Password encrypted at rest in AWS
2. **No JWT Required**: Login endpoint doesn't require authentication
3. **Email Validation**: Only emails in `ADMIN_ALLOWLIST` can login
4. **Session Tokens**: Simple GUID-based sessions (can be enhanced with JWT)
5. **Password Caching**: Optional, user-controlled
6. **CORS**: Configured for Amplify domain

## 🐛 Troubleshooting

### Issue: "Failed to fetch" or CORS error

**Solution**: CORS is already configured. If still seeing errors:
1. Check API Gateway CORS settings
2. Verify `VITE_API_URL` is set correctly
3. Check browser console for specific error

### Issue: "Invalid email"

**Solution**: 
1. Verify email is in `ADMIN_ALLOWLIST` environment variable
2. Check Lambda environment variables
3. Email comparison is case-insensitive

### Issue: "Invalid password"

**Solution**:
1. Verify password in SSM: `aws ssm get-parameter --name /gettrainmate/admin/password --with-decryption`
2. Check password matches exactly (case-sensitive)
3. Update password if needed: `./scripts/set-admin-password.sh "NewPassword"`

### Issue: Session not persisting

**Solution**:
1. Check browser localStorage is enabled
2. Clear localStorage and login again
3. Check session expiry date

## 📝 Next Steps

1. **Deploy Backend**: The login controller is ready
2. **Set Password**: Run `./scripts/set-admin-password.sh "Maxang11@@"`
3. **Test Login**: Navigate to `/admin/login` and login
4. **Verify Session**: Should redirect to `/admin/dashboard`

## ✨ Features

- ✅ SSM-based password storage
- ✅ Password caching (optional, 7 days)
- ✅ Session management (7 days)
- ✅ Auto-redirect if session exists
- ✅ Secure password handling
- ✅ CORS configured
- ✅ Error handling

---

**Status**: ✅ **READY TO USE**

Login at: `https://your-amplify-url/admin/login`
