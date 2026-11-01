import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@majestic/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, CheckCircle, XCircle, Clock, TrendingUp, Eye } from 'lucide-react';

// Роли с доступом к странице
const ALLOWED_ROLES = [
  '1482048390148784234',
  '1550899527450632362',
  '1550078792813256754',
  '1482048390157303913',
  '1482048390157303914',
];

// Проверка доступа
function hasAccess(userRoles: any): boolean {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return userRoles.some((role: any) => ALLOWED_ROLES.includes(role.id));
}

async function getApplications() {
  const applications = await prisma.application.findMany({
    include: {
      user: {
        select: {
          username: true,
          discriminator: true,
          avatar: true,
          discordId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return applications;
}

export default async function ApplicationsPage() {
  const session = await auth();
  
  // Проверка доступа
  if (!session?.user?.discordRoles || !hasAccess(session.user.discordRoles)) {
    redirect('/dashboard');
  }
  
  const applications = await getApplications();
  type Application = typeof applications[number];

  const stats = {
    total: applications.length,
    pending: applications.filter((a: Application) => a.status === 'PENDING').length,
    approved: applications.filter((a: Application) => a.status === 'APPROVED').length,
    rejected: applications.filter((a: Application) => a.status === 'REJECTED').length,
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    PENDING: {
      label: 'На рассмотрении',
      color: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      icon: Clock,
    },
    APPROVED: {
      label: 'Одобрена',
      color: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
      icon: CheckCircle,
    },
    REJECTED: {
      label: 'Отклонена',
      color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
      icon: XCircle,
    },
    CANCELLED: {
      label: 'Отменена',
      color: 'bg-gray-100 dark:bg-gray-950 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800',
      icon: XCircle,
    },
  };

  const typeLabels: Record<string, string> = {
    STAFF: 'Прием на работу',
    PROMOTION: 'Повышение',
    TRANSFER: 'Перевод',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Управление заявками
        </h1>
        <p className="text-muted-foreground mt-2">
          Просматривайте и обрабатывайте заявки пользователей
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Всего заявок</CardDescription>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ClipboardList className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">На рассмотрении</CardDescription>
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-4 w-4 text-yellow-400" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Одобрено</CardDescription>
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Отклонено</CardDescription>
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-4 w-4 text-red-400" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.rejected}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Applications List */}
      <div className="grid gap-4">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">Нет заявок</p>
              <p className="text-sm text-muted-foreground">Заявки появятся здесь после подачи</p>
            </CardContent>
          </Card>
        ) : (
          applications.map((app: Application) => {
            const status = statusConfig[app.status];
            const StatusIcon = status.icon;

            return (
              <Card key={app.id} className="group hover:shadow-2xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      {app.user.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${app.user.discordId}/${app.user.avatar}.png`}
                          alt={app.user.username}
                          className="w-16 h-16 rounded-xl ring-2 ring-border group-hover:ring-primary transition-all"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl ring-2 ring-border group-hover:ring-primary transition-all">
                          {app.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                            {app.user.username}
                            {app.user.discriminator !== '0' && (
                              <span className="text-muted-foreground">#{app.user.discriminator}</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-medium px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              {typeLabels[app.type]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(app.createdAt).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border-2 ${status.color}`}>
                          <StatusIcon className="h-4 w-4" />
                          {status.label}
                        </span>
                      </div>

                      {/* Position */}
                      <div className="bg-muted/50 rounded-xl p-4 border border-border">
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Должность:</p>
                        <p className="font-bold text-lg">{app.position}</p>
                      </div>

                      {/* Motivation */}
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Мотивация:</p>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                          {app.motivation}
                        </p>
                      </div>

                      {/* Experience */}
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Опыт работы:</p>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                          {app.experience}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 pt-3 border-t border-border">
                        <Button variant="default" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Подробнее
                        </Button>
                        {app.status === 'PENDING' && (
                          <>
                            <Button variant="success" size="sm" className="gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Одобрить
                            </Button>
                            <Button variant="destructive" size="sm" className="gap-2">
                              <XCircle className="h-4 w-4" />
                              Отклонить
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
