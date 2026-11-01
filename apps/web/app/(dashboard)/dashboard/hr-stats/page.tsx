import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@majestic/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, UserCheck, UserX, TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react';

// Роли с доступом к странице "Отдел Дисциплины"
const ALLOWED_ROLES = [
  '1482048390148784234',
  '1550899527450632362',
  '1550078792813256754',
  '1482048390157303913',
  '1482048390157303914',
  '1482048390148784230',
];

// Проверка доступа
function hasAccess(userRoles: any): boolean {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return userRoles.some((role: any) => ALLOWED_ROLES.includes(role.id));
}

async function getDisciplineStats() {
  const [totalUsers, activeUsers, suspendedUsers, bannedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { status: 'BANNED' } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
  };
}

export default async function HRStatsPage() {
  const session = await auth();
  
  // Проверка доступа
  if (!session?.user?.discordRoles || !hasAccess(session.user.discordRoles)) {
    redirect('/dashboard');
  }
  
  const stats = await getDisciplineStats();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Отдел Дисциплины
        </h1>
        <p className="text-muted-foreground mt-2">
          Статистика и управление дисциплинарными мерами
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Всего пользователей</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.totalUsers}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Активные</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                <UserCheck className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.activeUsers}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Приостановлены</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.suspendedUsers}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Заблокированы</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-pink-500">
                <UserX className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{stats.bannedUsers}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Дисциплинарные меры</CardTitle>
              <CardDescription>История нарушений и наказаний</CardDescription>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">
              Раздел в разработке
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Здесь будет отображаться детальная статистика дисциплинарных мер
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Тренды</CardTitle>
            <CardDescription>Изменения за последний месяц</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold">Активные пользователи</p>
                  <p className="text-sm text-muted-foreground">Рост активности</p>
                </div>
              </div>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">+12%</span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="font-semibold">Нарушения</p>
                  <p className="text-sm text-muted-foreground">Снижение нарушений</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">-8%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Быстрые действия</CardTitle>
            <CardDescription>Управление дисциплиной</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                Функции управления будут доступны в следующем обновлении
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
