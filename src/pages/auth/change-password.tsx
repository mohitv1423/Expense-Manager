import { zodResolver } from '@hookform/resolvers/zod';
import { type GetServerSideProps, type NextPage } from 'next';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { LoadingSpinner } from '~/components/ui/spinner';
import { getServerAuthSession } from '~/server/auth';
import { customServerSideTranslations } from '~/utils/i18n/server';
import { api } from '~/utils/api';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const ChangePasswordPage: NextPage<{ isForced: boolean }> = ({ isForced }) => {
  const router = useRouter();
  const { update } = useSession();
  const changePasswordMutation = api.user.changePassword.useMutation();

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = useCallback(
    async (values: ChangePasswordValues) => {
      try {
        await changePasswordMutation.mutateAsync({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        });

        // Update session to clear forcePasswordChange
        await update();
        toast.success('Password changed successfully');
        void router.push('/balances');
      } catch (err: any) {
        const message = err?.message ?? 'Failed to change password';
        toast.error(message);
      }
    },
    [changePasswordMutation, router, update],
  );

  return (
    <>
      <Head>
        <title>Change Password – SplitPro</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary">SplitPro</h1>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold text-card-foreground">
              {isForced ? 'Set a new password' : 'Change password'}
            </h2>
            {isForced && (
              <p className="mb-6 text-sm text-muted-foreground">
                Your account requires a password change before you can continue.
              </p>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isForced ? 'Temporary password' : 'Current password'}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Min. 8 characters with uppercase, lowercase, number, and special character.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner className="h-4 w-4" />
                      Saving…
                    </span>
                  ) : (
                    'Set new password'
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </main>
    </>
  );
};

ChangePasswordPage.auth = true;

export default ChangePasswordPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context);

  if (!session) {
    return { redirect: { destination: '/auth/signin', permanent: false } };
  }

  return {
    props: {
      ...(await customServerSideTranslations(context.locale, ['common'])),
      isForced: session.user.forcePasswordChange,
    },
  };
};
