import { zodResolver } from '@hookform/resolvers/zod';
import { type GetServerSideProps, type NextPage } from 'next';
import { signIn } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { LoadingSpinner } from '~/components/ui/spinner';
import { getServerAuthSession } from '~/server/auth';
import { customServerSideTranslations } from '~/utils/i18n/server';

const signInSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type SignInValues = z.infer<typeof signInSchema>;

const SignInPage: NextPage<{ callbackUrl?: string }> = ({ callbackUrl }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = useCallback(
    async (values: SignInValues) => {
      setIsLoading(true);
      try {
        const result = await signIn('credentials', {
          email: values.email.toLowerCase().trim(),
          password: values.password,
          redirect: false,
          callbackUrl: callbackUrl ?? '/balances',
        });

        if (result?.error) {
          if (result.error.startsWith('AccountLocked:')) {
            const minutes = result.error.split(':')[1];
            toast.error(`Account locked. Please try again in ${minutes} minutes.`);
          } else if (result.error === 'AccountDisabled') {
            toast.error('Your account has been disabled. Please contact the administrator.');
          } else {
            toast.error('Invalid email or password.');
          }
        } else if (result?.ok) {
          // Refetch session to get forcePasswordChange flag
          const sessionRes = await fetch('/api/auth/session');
          const session = await sessionRes.json() as { user?: { forcePasswordChange?: boolean } };

          if (session?.user?.forcePasswordChange) {
            void router.push('/auth/change-password');
          } else {
            void router.push(result.url ?? callbackUrl ?? '/balances');
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [callbackUrl, router],
  );

  return (
    <>
      <Head>
        <title>Sign In – SplitPro</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo / Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary">SplitPro</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Private expense management
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <h2 className="mb-6 text-xl font-semibold text-card-foreground">Sign in</h2>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner className="h-4 w-4" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>
            </Form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Forgot your password? Contact your administrator.
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default SignInPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context);
  const { callbackUrl } = context.query;

  if (session) {
    if (session.user.forcePasswordChange) {
      return { redirect: { destination: '/auth/change-password', permanent: false } };
    }
    const destination =
      callbackUrl && !Array.isArray(callbackUrl) ? callbackUrl : '/balances';
    return { redirect: { destination, permanent: false } };
  }

  return {
    props: {
      ...(await customServerSideTranslations(context.locale, ['common'])),
      callbackUrl: callbackUrl && !Array.isArray(callbackUrl) ? callbackUrl : '',
    },
  };
};
