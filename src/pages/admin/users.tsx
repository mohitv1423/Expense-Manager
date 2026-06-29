import { zodResolver } from '@hookform/resolvers/zod';
import { type GetServerSideProps, type NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ArrowLeft, Plus, MoreVertical, Shield, ShieldOff, KeyRound, Pencil } from 'lucide-react';
import { api } from '~/utils/api';
import { getServerAuthSession } from '~/server/auth';
import { customServerSideTranslations } from '~/utils/i18n/server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Badge } from '~/components/ui/badge';
import { LoadingSpinner } from '~/components/ui/spinner';

// ---- Zod schemas ----
const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  temporaryPassword: z.string().min(6, 'Temporary password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'USER']),
});
type CreateUserValues = z.infer<typeof createUserSchema>;

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const editUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['ADMIN', 'USER']),
});
type EditUserValues = z.infer<typeof editUserSchema>;

// ---- Component ----
const AdminUsersPage: NextPage = () => {
  const usersQuery = api.admin.listUsers.useQuery();
  const createUserMutation = api.admin.createUser.useMutation();
  const editUserMutation = api.admin.editUser.useMutation();
  const disableUserMutation = api.admin.setUserActive.useMutation();
  const resetPasswordMutation = api.admin.resetPassword.useMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: number; firstName: string; lastName: string; role: string } | null>(null);

  const createForm = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName: '', lastName: '', email: '', temporaryPassword: '', role: 'USER' },
  });

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { temporaryPassword: '' },
  });

  const editForm = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
  });

  const onCreateUser = useCallback(async (values: CreateUserValues) => {
    try {
      await createUserMutation.mutateAsync(values);
      toast.success(`User ${values.firstName} ${values.lastName} created.`);
      setShowCreate(false);
      createForm.reset();
      void usersQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create user');
    }
  }, [createUserMutation, createForm, usersQuery]);

  const onResetPassword = useCallback(async (values: ResetPasswordValues) => {
    if (!resetTarget) return;
    try {
      await resetPasswordMutation.mutateAsync({ userId: resetTarget.id, temporaryPassword: values.temporaryPassword });
      toast.success('Password reset successfully.');
      setResetTarget(null);
      resetForm.reset();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to reset password');
    }
  }, [resetPasswordMutation, resetTarget, resetForm]);

  const onEditUser = useCallback(async (values: EditUserValues) => {
    if (!editTarget) return;
    try {
      await editUserMutation.mutateAsync({ userId: editTarget.id, ...values });
      toast.success('User updated.');
      setEditTarget(null);
      void usersQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update user');
    }
  }, [editUserMutation, editTarget, usersQuery]);

  const toggleActive = useCallback(async (userId: number, active: boolean) => {
    try {
      await disableUserMutation.mutateAsync({ userId, active });
      toast.success(active ? 'User enabled.' : 'User disabled.');
      void usersQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update user status');
    }
  }, [disableUserMutation, usersQuery]);

  const openEdit = useCallback((user: { id: number; firstName?: string | null; lastName?: string | null; role: string }) => {
    setEditTarget({ id: user.id, firstName: user.firstName ?? '', lastName: user.lastName ?? '', role: user.role });
    editForm.reset({ firstName: user.firstName ?? '', lastName: user.lastName ?? '', role: user.role as 'ADMIN' | 'USER' });
  }, [editForm]);

  return (
    <>
      <Head><title>User Management – SplitPro Admin</title></Head>
      <main className="min-h-screen bg-background p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          </div>

          <div className="mb-4 flex justify-end">
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add User
            </Button>
          </div>

          {/* Users table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {usersQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <LoadingSpinner className="h-6 w-6" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersQuery.data?.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {user.firstName} {user.lastName}
                        {user.forcePasswordChange && (
                          <span className="ml-2 text-xs text-amber-500">(temp pwd)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.active ? 'outline' : 'destructive'}>
                          {user.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetTarget({ id: user.id, name: `${user.firstName} ${user.lastName}` })}>
                              <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                            </DropdownMenuItem>
                            {user.active ? (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => void toggleActive(user.id, false)}
                              >
                                <ShieldOff className="mr-2 h-4 w-4" /> Disable
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => void toggleActive(user.id, true)}>
                                <Shield className="mr-2 h-4 w-4" /> Enable
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateUser)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={createForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={createForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={createForm.control} name="temporaryPassword" render={({ field }) => (
                <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="text" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={createForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <select {...field} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password – {resetTarget?.name}</DialogTitle>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <FormField control={resetForm.control} name="temporaryPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Temporary Password</FormLabel>
                  <FormControl><Input type="text" placeholder="Temp@1234" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : 'Reset Password'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditUser)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <select {...field} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={editUserMutation.isPending}>
                  {editUserMutation.isPending ? <LoadingSpinner className="h-4 w-4" /> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUsersPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context);

  if (!session) return { redirect: { destination: '/auth/signin', permanent: false } };
  if (session.user.role !== 'ADMIN') return { redirect: { destination: '/balances', permanent: false } };
  if (session.user.forcePasswordChange) return { redirect: { destination: '/auth/change-password', permanent: false } };

  return { props: { ...(await customServerSideTranslations(context.locale, ['common'])) } };
};
