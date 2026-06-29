import { db } from '~/server/db';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;

export async function checkLoginRateLimit(email: string): Promise<{ allowed: boolean; minutesRemaining?: number }> {
  const user = await db.user.findUnique({
    where: { email },
    select: { loginAttempts: true, lockedUntil: true, active: true },
  });

  if (!user) {
    // Still track attempts for non-existent users to prevent enumeration
    return { allowed: true };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { allowed: false, minutesRemaining };
  }

  // Reset if lockout expired
  if (user.lockedUntil && user.lockedUntil <= new Date()) {
    await db.user.update({
      where: { email },
      data: { loginAttempts: 0, lockedUntil: null },
    });
  }

  return { allowed: true };
}

export async function recordFailedAttempt(email: string, ipAddress?: string): Promise<void> {
  await db.loginAttempt.create({
    data: { email, ipAddress, success: false },
  });

  const user = await db.user.findUnique({
    where: { email },
    select: { loginAttempts: true },
  });

  if (!user) return;

  const newAttempts = user.loginAttempts + 1;

  if (newAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await db.user.update({
      where: { email },
      data: { loginAttempts: newAttempts, lockedUntil },
    });
  } else {
    await db.user.update({
      where: { email },
      data: { loginAttempts: newAttempts },
    });
  }
}

export async function recordSuccessfulLogin(email: string, ipAddress?: string): Promise<void> {
  await db.loginAttempt.create({
    data: { email, ipAddress, success: true },
  });

  await db.user.update({
    where: { email },
    data: { loginAttempts: 0, lockedUntil: null },
  });
}
