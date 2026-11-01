import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@majestic/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, Filter, Download, UserCog, Shield, Ban } from 'lucide-react';
import Image from 'next/image';

// Роли с доступом к странице
const ALLOWED_ROLES = [
  '1482048390148784234',
  '1550899527450632362',
  '1550078792813256754',
  '1482048390157303913',
  '1482048390157303914',
];

// Роль сотрудника (для фильтрации списка)
const EMPLOYEE_ROLE_ID = '1482048390119555125';

// Проверка доступа
function hasAccess(userRoles: any): boolean {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return userRoles.some((role: any) => ALLOWED_ROLES.includes(role.id));
}

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
  
  // Показываем до 3 ролей
  const displayRoles = filteredRoles.slice(0, 3);
  const remainingCount = filteredRoles.length - 3;
  
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {displayRoles.map((role: any) => {
        // Конвертируем цвет Discord (integer) в HEX
        const colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
        
        return (
          <span
            key={role.id}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
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
        <span className="text-xs text-muted-foreground font-medium">+{remainingCount}</span>
      )}
    </div>
  );
}

async function getUsers() {
  // Получаем всех пользователей
  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
  
  // Фильтруем только сотрудников (с ролью EMPLOYEE_ROLE_ID)
  const employees = allUsers.filter(user => {
    if (!user.discordRoles || !Array.isArray(user.discordRoles)) return false;
    return user.discordRoles.some((role: any) => role.id === EMPLOYEE_ROLE_ID);
  });
  
  return employees;
}

export default async function UsersPage() {
  const session = await auth();
  
  // Проверка доступа
  if (!session?.user?.discordRoles || !hasAccess(session.user.discordRoles)) {
    redirect('/dashboard');
  }
  
  const users = await getUsers();
  type User = typeof users[number];

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-500/10 text-red-400 border border-red-500/20',
    ADMIN: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    HR_MANAGER: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    HR_STAFF: 'bg-green-500/10 text-green-400 border border-green-500/20',
    MODERATOR: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    MEMBER: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950',
    SUSPENDED: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950',
    BANNED: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950',
    INACTIVE: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-950',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Управление сотрудниками
        </h1>
        <p className="text-muted-foreground mt-2">
          Управляйте сотрудниками, ролями и доступом
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени, email или Discord ID..."
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Фильтры
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Экспорт
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Всего сотрудников</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Активные</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                <Shield className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {users.filter((u: User) => u.status === 'ACTIVE').length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Админы</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <UserCog className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {users.filter((u: User) => u.role.includes('ADMIN')).length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Заблокированные</CardDescription>
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
                <Ban className="h-4 w-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {users.filter((u: User) => u.status === 'BANNED').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Список сотрудников</CardTitle>
          <CardDescription>Всего найдено: {users.length} сотрудников</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Сотрудник
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Discord ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Роли
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Дата найма
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user: User) => (
                  <tr 
                    key={user.id}
                    className="hover:bg-accent/50 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {user.avatar ? (
                            <Image
                              src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
                              alt={user.username}
                              width={40}
                              height={40}
                              className="rounded-full ring-2 ring-border group-hover:ring-primary transition-all"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-border group-hover:ring-primary transition-all">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                            user.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">
                            {user.displayName || user.username}
                            {!user.displayName && user.discriminator !== '0' && (
                              <span className="text-muted-foreground">#{user.discriminator}</span>
                            )}
                          </p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {user.discordId}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderDiscordRoles(user.discordRoles)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${statusColors[user.status]}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
