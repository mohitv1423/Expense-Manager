import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { db } from '~/server/db';
import { hashPassword } from '~/lib/auth/password';

/** Middleware that ensures the calling user is ADMIN */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const adminRouter = createTRPCRouter({
  /** List all users */
  listUsers: adminProcedure.query(async () => {
    return db.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        role: true,
        active: true,
        forcePasswordChange: true,
        image: true,
      },
      orderBy: { id: 'asc' },
    });
  }),

  /** Create a new user with a temporary password */
  createUser: adminProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        temporaryPassword: z.string().min(6),
        role: z.enum(['ADMIN', 'USER']),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A user with this email already exists' });
      }

      const passwordHash = await hashPassword(input.temporaryPassword);
      const fullName = `${input.firstName} ${input.lastName}`.trim();

      return db.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          name: fullName,
          email: input.email.toLowerCase(),
          passwordHash,
          role: input.role,
          forcePasswordChange: true,
          active: true,
        },
      });
    }),

  /** Edit an existing user's name and role */
  editUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(['ADMIN', 'USER']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Prevent admin from removing their own admin role
      if (input.userId === ctx.session.user.id && input.role !== 'ADMIN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot remove your own admin role' });
      }

      const fullName = `${input.firstName} ${input.lastName}`.trim();

      return db.user.update({
        where: { id: input.userId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          name: fullName,
          role: input.role,
        },
      });
    }),

  /** Enable or disable a user account */
  setUserActive: adminProcedure
    .input(z.object({ userId: z.number(), active: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot disable your own account' });
      }

      return db.user.update({
        where: { id: input.userId },
        data: { active: input.active },
      });
    }),

  /** Reset a user's password to a new temporary password */
  resetPassword: adminProcedure
    .input(z.object({ userId: z.number(), temporaryPassword: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const passwordHash = await hashPassword(input.temporaryPassword);

      return db.user.update({
        where: { id: input.userId },
        data: {
          passwordHash,
          forcePasswordChange: true,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });
    }),
});
