import { type GetServerSidePropsContext } from 'next';
import { type DefaultSession, type NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { db } from '~/server/db';
import { verifyPassword } from '~/lib/auth/password';
import { checkLoginRateLimit, recordFailedAttempt, recordSuccessfulLogin } from '~/lib/auth/rateLimit';

/**
 * Module augmentation for `next-auth` types.
 */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: DefaultSession['user'] & {
      id: number;
      currency: string;
      defaultCurrency?: string | null;
      obapiProviderId?: string;
      bankingId?: string;
      preferredLanguage: string;
      hiddenFriendIds: number[];
      role: string;
      forcePasswordChange: boolean;
    };
  }

  interface User {
    id: number;
    name: string;
    email: string;
    image: string;
    currency: string;
    defaultCurrency?: string | null;
    obapiProviderId?: string;
    bankingId?: string;
    preferredLanguage: string;
    hiddenFriendIds: number[];
    role: string;
    forcePasswordChange: boolean;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 */
export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.currency = user.currency;
        token.defaultCurrency = user.defaultCurrency;
        token.obapiProviderId = user.obapiProviderId;
        token.bankingId = user.bankingId;
        token.preferredLanguage = user.preferredLanguage;
        token.hiddenFriendIds = user.hiddenFriendIds;
        token.role = user.role;
        token.forcePasswordChange = user.forcePasswordChange;
      }

      // Refresh user data from DB on each JWT refresh to pick up changes
      if (token.email && !user) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email as string },
          select: {
            id: true,
            role: true,
            active: true,
            forcePasswordChange: true,
            currency: true,
            defaultCurrency: true,
            preferredLanguage: true,
            hiddenFriendIds: true,
          },
        });

        if (dbUser && dbUser.active) {
          token.role = dbUser.role;
          token.forcePasswordChange = dbUser.forcePasswordChange;
          token.currency = dbUser.currency;
          token.defaultCurrency = dbUser.defaultCurrency;
          token.preferredLanguage = dbUser.preferredLanguage;
          token.hiddenFriendIds = dbUser.hiddenFriendIds;
        } else if (!dbUser?.active) {
          // User has been disabled
          return { ...token, error: 'AccountDisabled' };
        }
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as number,
          currency: token.currency as string,
          defaultCurrency: token.defaultCurrency as string | null | undefined,
          obapiProviderId: token.obapiProviderId as string | undefined,
          bankingId: token.bankingId as string | undefined,
          preferredLanguage: token.preferredLanguage as string,
          hiddenFriendIds: (token.hiddenFriendIds as number[]) ?? [],
          role: token.role as string,
          forcePasswordChange: token.forcePasswordChange as boolean,
        },
      };
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const ipAddress = (req?.headers?.['x-forwarded-for'] as string) ?? undefined;

        // Check rate limit / lockout
        const rateCheck = await checkLoginRateLimit(email);
        if (!rateCheck.allowed) {
          throw new Error(`AccountLocked:${rateCheck.minutesRemaining ?? 15}`);
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            passwordHash: true,
            role: true,
            active: true,
            forcePasswordChange: true,
            currency: true,
            defaultCurrency: true,
            preferredLanguage: true,
            hiddenFriendIds: true,
          },
        });

        if (!user || !user.passwordHash) {
          await recordFailedAttempt(email, ipAddress);
          return null;
        }

        if (!user.active) {
          throw new Error('AccountDisabled');
        }

        const passwordValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!passwordValid) {
          await recordFailedAttempt(email, ipAddress);
          return null;
        }

        await recordSuccessfulLogin(email, ipAddress);

        return {
          id: user.id,
          name: user.name ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          email: user.email!,
          image: user.image ?? '',
          currency: user.currency,
          defaultCurrency: user.defaultCurrency,
          preferredLanguage: user.preferredLanguage,
          hiddenFriendIds: user.hiddenFriendIds,
          role: user.role,
          forcePasswordChange: user.forcePasswordChange,
        };
      },
    }),
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext['req'];
  res: GetServerSidePropsContext['res'];
}) => getServerSession(ctx.req, ctx.res, authOptions);

export const getServerAuthSessionForSSG = async (context: GetServerSidePropsContext) => {
  const session = await getServerAuthSession(context);

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: session.user,
    },
  };
};

export function validateAuthEnv() {
  // Credentials provider requires no external env vars
  console.log('Custom credentials auth configured');
}
