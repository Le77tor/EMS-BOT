import { prisma } from '@majestic/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Activity,
  Clock,
  Award
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { ShareButton } from './share-button';

interface PageProps {
  params: Promise<{
    discordId: string;
  }>;
}

// Утилита для рендера Discord ролей с цветами
function renderDiscordRoles(discordRoles: any) {
  if (!discordRoles || !Array.isArray(discordRoles) || discordRoles.length === 0) {
    return <span className="text-sm text-muted-foreground">Нет ролей</span>;
  }
  
  const filteredRoles = discordRoles.filter(
    (role: any) => role.name !== '@everyone' && !role.name.toLowerCase().includes('bot')
  );
  
  if (filteredRoles.length === 0) {
    return <span className="text-sm text-muted-foreground">Нет ролей</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {filteredRoles.map((role: any) => {
        const colorHex = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
        
        return (
          <span
            key={role.id}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold"
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
    </div>
  );
}

// Получить самую высокую роль
function getHighestRole(discordRoles?: any[]) {
  if (!discordRoles || !Array.isArray(discordRoles) || discordRoles.length === 0) {
    return null;
  }

  const filteredRoles = discordRoles.filter(
    (role: any) => role.name !== '@everyone' && !role.name.toLowerCase().includes('bot')
  );

  const sortedByPosition = filteredRoles.sort((a: any, b: any) => b.position - a.position);
  return sortedByPosition[0] || null;
}

async function getUserProfile(discordId: string) {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });
  return user;
}

export default async function UserProfilePage({ params }: PageProps) {
  const { discordId } = await params;
  const user = await getUserProfile(discordId);
  const session = await auth();

  if (!user) {
    notFound();
  }

  const isOwnProfile = session?.user && (session.user as any).discordId === discordId;
  const highestRole = getHighestRole(user.discordRoles as any);
  const roleColor = highestRole?.color ? `#${highestRole.color.toString(16).padStart(6, '0')}` : null;

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-gradient-to-r from-red-500 to-pink-500 text-white',
    ADMIN: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
    HR_MANAGER: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    HR_STAFF: 'bg-gradient-to-r from-teal-500 to-green-500 text-white',
    MODERATOR: 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white',
    MEMBER: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400',
    SUSPENDED: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400',
    BANNED: 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400',
    INACTIVE: 'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400',
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Активен',
    SUSPENDED: 'Приостановлен',
    BANNED: 'Заблокирован',
    INACTIVE: 'Неактивен',
  };

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Супер Администратор',
    ADMIN: 'Администратор',
    HR_MANAGER: 'HR Менеджер',
    HR_STAFF: 'HR Сотрудник',
    MODERATOR: 'Модератор',
    MEMBER: 'Участник',
  };

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=256`
    : null;

  // Форматирование имени пользователя (убираем #0)
  const formattedUsername = user.discriminator === '0' || user.discriminator === '0000'
    ? user.username
    : `${user.username}#${user.discriminator}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Card */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={user.displayName || user.username}
                  width={128}
                  height={128}
                  className="rounded-2xl ring-4 ring-border shadow-xl"
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl ring-4 ring-border shadow-xl">
                  {(user.displayName || user.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-black">
                    {user.displayName || user.username}
                  </h1>
                  {isOwnProfile && (
                    <Badge variant="outline" className="text-xs">
                      Это ты
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  @{formattedUsername}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={roleColors[user.role] || roleColors.MEMBER}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabels[user.role] || user.role}
                </Badge>
                <Badge className={statusColors[user.status] || statusColors.INACTIVE}>
                  <Activity className="h-3 w-3 mr-1" />
                  {statusLabels[user.status] || user.status}
                </Badge>
              </div>

              <div className="flex gap-2 pt-2">
                <ShareButton discordId={discordId} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Discord Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Discord роли
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderDiscordRoles(user.discordRoles)}
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                О пользователе
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Отображаемое имя
                  </p>
                  <p className="font-medium">{user.displayName || 'Не указано'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Имя пользователя
                  </p>
                  <p className="font-medium">
                    {formattedUsername}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <p className="font-medium">{user.email || 'Не указан'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Discord ID
                  </p>
                  <p className="font-mono text-sm">{user.discordId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Статистика
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Дата регистрации
                </p>
                <p className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Последний вход
                </p>
                <p className="font-medium">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Никогда'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Highest Role Card */}
          {highestRole && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Высшая роль
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="p-4 rounded-lg text-center font-bold text-lg"
                  style={{
                    backgroundColor: roleColor ? `${roleColor}20` : '#f0f0f0',
                    color: roleColor || '#333',
                    border: `2px solid ${roleColor || '#ccc'}`,
                  }}
                >
                  {highestRole.name}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
