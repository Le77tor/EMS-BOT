import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  // 🧪 DEBUG: Проверяем что приходит в сессии
  console.log('='.repeat(80));
  console.log('[layout] 🔍 SESSION DEBUG:');
  console.log('[layout] session.user:', session.user);
  console.log('[layout] discordRoles type:', typeof (session.user as any)?.discordRoles);
  console.log('[layout] discordRoles value:', (session.user as any)?.discordRoles);
  console.log('[layout] discordRoles is Array?', Array.isArray((session.user as any)?.discordRoles));
  console.log('[layout] discordRoles length:', (session.user as any)?.discordRoles?.length || 0);
  if ((session.user as any)?.discordRoles) {
    console.log('[layout] First 3 roles:', (session.user as any)?.discordRoles.slice(0, 3));
  }
  console.log('='.repeat(80));

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-950 dark:via-blue-950/30 dark:to-purple-950/30">
      <Sidebar userRoles={session.user?.discordRoles} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={session.user ?? { name: null, email: null, image: null, role: undefined, discordRoles: null, discordId: undefined }} />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
