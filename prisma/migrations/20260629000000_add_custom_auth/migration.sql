-- Add custom authentication fields to User table

-- Add role enum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER');

-- Add new columns to User
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Add LoginAttempt table for rate limiting
CREATE TABLE IF NOT EXISTS "public"."LoginAttempt" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "ipAddress" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginAttempt_email_createdAt_idx" ON "public"."LoginAttempt"("email", "createdAt");
