# Migration: Add Resignation and Warnings

## Changes

### 1. Added RESIGNATION to ApplicationType enum
- Allows users to submit resignation applications from the web portal
- Applications are sent to Discord for HR review

### 2. Added REVIEWED to ApplicationStatus enum
- New status for applications that are being reviewed by HR
- Provides better status tracking for the application workflow

### 3. Created Warning model
- Tracks employee warnings/strikes
- Fields:
  - reason: Description of the warning
  - severity: MINOR, MODERATE, or SEVERE
  - status: ACTIVE, EXPIRED, or REMOVED
  - issuedBy: Discord ID of who issued the warning
  - expiresAt: Optional expiration date
  - removedBy/removedAt: If warning was removed early
  - removeReason: Reason for early removal

### 4. Updated User model
- Added warnings relation to track user warnings

## Purpose

This migration enables:
- Resignation applications from web portal
- Automatic checking if user should be blacklisted on resignation (based on warnings and internship status)
- Warning/strike tracking system for HR
- Better application status management

## Deployment

Run on production:
```bash
npx prisma migrate deploy
```

Or generate Prisma client after pulling:
```bash
npx prisma generate
```
