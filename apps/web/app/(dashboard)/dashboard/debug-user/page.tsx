import { auth } from '@/lib/auth';
import { prisma } from '@majestic/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { redirect } from 'next/navigation';

export default async function UserDebugPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const account = await prisma.account.findFirst({
    where: { userId: userId },
  });

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">User Debug Info</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Session Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database User</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discord Account</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto">
            {JSON.stringify({
              provider: account?.provider,
              providerAccountId: account?.providerAccountId,
              hasAccessToken: !!account?.access_token,
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What's being displayed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Username:</strong> {user?.username}</p>
            <p><strong>DisplayName:</strong> {user?.displayName || '(null)'}</p>
            <p><strong>What shows on page:</strong> {user?.displayName || user?.username}</p>
            <p><strong>Discriminator:</strong> {user?.discriminator}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
