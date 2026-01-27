# Cognito User Pool Configuration Guide

## Required Attributes Configuration

To ensure that `given_name` is required during signup but not during sign-in or password reset:

### 1. In AWS Cognito Console

1. Go to **AWS Cognito Console** → Your User Pool
2. Navigate to **Sign-up experience** → **Attributes**
3. Under **Required attributes**, ensure:
   - ✅ `email` is checked (required)
   - ✅ `given_name` is checked (required for signup)
   - ❌ Do NOT check `name` (we use `given_name` instead)

### 2. Attribute Settings

- **`email`**: Required, Mutable, Verified
- **`given_name`**: Required, Mutable, Not verified

### 3. Why This Works

- **During Signup**: User must provide `given_name` (enforced by Cognito)
- **During Sign-In**: No attributes required (just email/password)
- **During Password Reset**: We send a default `given_name: 'User'` value to satisfy Cognito's requirement without asking the user

### 4. Code Implementation

- **Signup**: Sends `given_name` from the name field
- **Password Reset**: Sends default `given_name: 'User'` automatically
- **Sign-In**: No attributes sent

## Alternative: Making `given_name` Optional

If you want to make `given_name` optional in Cognito:

1. Uncheck `given_name` from **Required attributes**
2. Update signup code to make name field optional
3. During password reset, you won't need to send `given_name` at all

**Note**: This means users can sign up without providing a name, which may not be desired.

## Current Implementation

The current code:
- ✅ Requires name during signup (sends as `given_name`)
- ✅ Doesn't require name during sign-in
- ✅ Sends default `given_name: 'User'` during password reset (satisfies Cognito requirement without user input)
