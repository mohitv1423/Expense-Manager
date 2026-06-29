import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { Users, Settings, LayoutDashboard } from 'lucide-react';
import { getServerAuthSession } from '~/server/auth';
import { customServerSideTranslations } from '~/utils/i18n/server';

const AdminIndexPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Admin Panel – SplitPro</title>
      </Head>
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="mb-10 text-muted-foreground">Manage users and application settings.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link href="/admin/users">
              <div className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition hover:border-primary hover:shadow-md">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground group-hover:text-primary">
                    User Management
                  </p>
                  <p className="text-sm text-muted-foreground">Create, edit, and manage users</p>
                </div>
              </div>
            </Link>

            <Link href="/groups">
              <div className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition hover:border-primary hover:shadow-md">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground group-hover:text-primary">
                    Group Management
                  </p>
                  <p className="text-sm text-muted-foreground">View and manage all groups</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
};

export default AdminIndexPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context);

  if (!session) {
    return { redirect: { destination: '/auth/signin', permanent: false } };
  }

  if (session.user.role !== 'ADMIN') {
    return { redirect: { destination: '/balances', permanent: false } };
  }

  if (session.user.forcePasswordChange) {
    return { redirect: { destination: '/auth/change-password', permanent: false } };
  }

  return {
    props: {
      ...(await customServerSideTranslations(context.locale, ['common'])),
    },
  };
};
