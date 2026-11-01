import { auth } from '@/lib/auth';
import { prisma } from '@majestic/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, GraduationCap, FileText, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { QuickActions } from '@/components/quick-actions';

// Утилита для рендера Discord ролей с цветами
function renderDiscordRoles(discordRoles: any) {
  if (!discordRoles || !Array.isArray(discordRoles) || discordRoles.length === 0) {
    return <span className="text-xs text-muted-foreground">Без ролей</span>;
  }
  
  const filteredRoles = discordRoles.filter(
    (role: any) => role.name !== '@everyone' && !role.name.toLowerCase().includes('bot')
  );
  
  if (filteredRoles.length === 0) {
    return <span className="text-xs text-muted-foreground">Без ролей</span>;
  }
  
  // Показываем до 2 ролей для компактности
  const displayRoles = filteredRoles.slice(0, 2);
  const remainingCount = filteredRoles.length - 2;
  
  return (
    <div className="flex flex-wrap items-center gap-1">
      {displayRoles.map((role: any) => {
        // Конвертируем цвет Discord (integer) в HEX
        const colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
        
        return (
          <span
            key={role.id}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
            style={{
              backgroundColor: `${colorHex}20`,
              color: colorHex,
              border: `1px solid ${colorHex}40`
            }}
          >
            {role.name}
          </span>
        );
      })}
      {remainingCount > 0 && (
        <span className="text-[10px] text-muted-foreground font-medium">+{remainingCount}</span>
      )}
    </div>
  );
}

async function getStats() {
  // ID роли сотрудника
  const EMPLOYEE_ROLE_ID = '1482048390119555125';
  
  // Получаем всех пользователей
  const allUsers = await prisma.user.findMany({
    select: {
      discordRoles: true,
    },
  });
  
  // Считаем только сотрудников
  const employeeCount = allUsers.filter(user => {
    if (!user.discordRoles || !Array.isArray(user.discordRoles)) return false;
    return user.discordRoles.some((role: any) => role.id === EMPLOYEE_ROLE_ID);
  }).length;
  
  const [pendingApps, publishedTests, publishedPosts] = await Promise.all([
    prisma.application.count({ where: { status: 'PENDING' } }),
    prisma.test.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
  ]);

  return { employeeCount, pendingApps, publishedTests, publishedPosts };
}

async function getRecentActivity() {
  // ID роли сотрудника
  const EMPLOYEE_ROLE_ID = '1482048390119555125';
  
  // Получаем всех пользователей с ролями
  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      displayName: true,
      discriminator: true,
      avatar: true,
      discordId: true,
      role: true,
      discordRoles: true,
      createdAt: true,
    },
  });
  
  // Фильтруем только сотрудников (у кого есть роль 1482048390119555125)
  const recentUsers = allUsers
    .filter(user => {
      if (!user.discordRoles || !Array.isArray(user.discordRoles)) return false;
      return user.discordRoles.some((role: any) => role.id === EMPLOYEE_ROLE_ID);
    })
    .slice(0, 5);

  const recentApps = await prisma.application.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          username: true,
          displayName: true,
          discriminator: true,
        },
      },
    },
  });

  return { recentUsers, recentApps };
}

export default async function DashboardPage() {
  const session = await auth();
  const stats = await getStats();
  const { recentUsers, recentApps } = await getRecentActivity();

  type RecentUser = typeof recentUsers[number];
  type RecentApp = typeof recentApps[number];

  const statCards = [
    {
      title: 'Сотрудники',
      description: 'Всего сотрудников',
      value: stats.employeeCount,
      icon: Users,
      color: 'blue',
      change: '+12%',
      changeType: 'up' as const,
    },
    {
      title: 'Заявки',
      description: 'Ожидают рассмотрения',
      value: stats.pendingApps,
      icon: ClipboardList,
      color: 'purple',
      change: '+8%',
      changeType: 'up' as const,
    },
    {
      title: 'Тесты',
      description: 'Опубликовано',
      value: stats.publishedTests,
      icon: GraduationCap,
      color: 'green',
      change: '+5%',
      changeType: 'up' as const,
    },
    {
      title: 'Посты',
      description: 'Всего создано',
      value: stats.publishedPosts,
      icon: FileText,
      color: 'orange',
      change: '-3%',
      changeType: 'down' as const,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section - тёмный с лёгким свечением */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Добро пожаловать, {session?.user?.name}! 👋
              </h1>
              <p className="text-muted-foreground">
                Вот что происходит сегодня
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Activity className="h-5 w-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">Все системы работают</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {new Date().toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <QuickActions />

      {/* Stats Grid - тёмные карточки с лёгким свечением при hover */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const ChangeIcon = stat.changeType === 'up' ? TrendingUp : TrendingDown;

          return (
            <Card 
              key={stat.title} 
              className="group hover:border-primary/50 transition-all"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium">
                    {stat.description}
                  </CardDescription>
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'blue' ? 'bg-blue-500/10' :
                    stat.color === 'purple' ? 'bg-purple-500/10' :
                    stat.color === 'green' ? 'bg-green-500/10' :
                    'bg-orange-500/10'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      stat.color === 'blue' ? 'text-blue-400' :
                      stat.color === 'purple' ? 'text-purple-400' :
                      stat.color === 'green' ? 'text-green-400' :
                      'text-orange-400'
                    }`} />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold mt-2">
                  {stat.value}
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </span>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${
                    stat.changeType === 'up' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    <ChangeIcon className="h-3 w-3" />
                    {stat.change}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Новые сотрудники</CardTitle>
                <CardDescription>Последние трудоустройства</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет новых сотрудников
                </p>
              ) : (
                recentUsers.map((user: RecentUser) => (
                  <div 
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="relative">
                      {user.avatar && user.discordId ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
                          alt={user.username}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm">
                        {user.displayName || user.username}
                        {!user.displayName && user.discriminator !== '0' && (
                          <span className="text-muted-foreground">#{user.discriminator}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {renderDiscordRoles(user.discordRoles)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Последние заявки</CardTitle>
                <CardDescription>Требуют рассмотрения</CardDescription>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <ClipboardList className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentApps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет новых заявок
                </p>
              ) : (
                recentApps.map((app: RecentApp) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {app.user.displayName || app.user.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {app.position}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        app.status === 'PENDING' 
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : app.status === 'APPROVED'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {app.motivation}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(app.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
