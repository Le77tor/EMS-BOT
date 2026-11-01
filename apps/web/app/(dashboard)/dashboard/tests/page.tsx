import { auth } from '@/lib/auth';
import { prisma } from '@majestic/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, Users, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { TestCard } from '@/components/tests/test-card';

// Роли с доступом к созданию тестов
const TEST_CREATOR_ROLES = [
  '1482048390157303914', // Лидер
  '1482048390157303913', // Зам. Лидера
  '1550078792813256754', // Куратор
  '1518978875059732601', // Куратор Мл. Состава
  '1518626611921027244', // Глава Отдела Дисциплины
];

function hasCreatorAccess(userRoles: any[] | null | undefined): boolean {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return userRoles.some((role: any) => TEST_CREATOR_ROLES.includes(role.id));
}

async function getTestsStats() {
  const [published, totalAttempts, passedAttempts] = await Promise.all([
    prisma.test.count({ where: { status: 'PUBLISHED' } }),
    prisma.testAttempt.count(),
    prisma.testAttempt.count({ where: { passed: true } }),
  ]);

  return { published, totalAttempts, passedAttempts };
}

async function getTests() {
  return await prisma.test.findMany({
    where: { status: { in: ['PUBLISHED', 'DRAFT'] } },
    include: {
      creator: {
        select: {
          username: true,
          displayName: true,
        },
      },
      questions: {
        select: { id: true },
      },
      attempts: {
        select: { id: true, passed: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export default async function TestsPage() {
  const session = await auth();
  const stats = await getTestsStats();
  const tests = await getTests();
  
  const canCreate = hasCreatorAccess(session?.user?.discordRoles);

  const statCards = [
    {
      title: 'Опубликовано',
      value: stats.published,
      description: 'доступно по ссылке',
      icon: FileText,
      color: 'blue',
    },
    {
      title: 'Прохождений',
      value: stats.totalAttempts,
      description: 'в журнале',
      icon: Users,
      color: 'purple',
    },
    {
      title: 'Пройдено',
      value: stats.passedAttempts,
      description: 'успешно',
      icon: BarChart3,
      color: 'green',
    },
    {
      title: 'Перемешивание',
      value: '2 уровня',
      description: 'вопросы и ответы',
      icon: Clock,
      color: 'orange',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Тесты и аттестации</h1>
          <p className="text-muted-foreground mt-2">
            Отдельные ссылки, случайный порядок вопросов и вариантов, автоматическая проверка и журнал результатов.
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/tests/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Создать тест
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
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
                <span className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary">
          Доступные тесты
        </button>
        <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          Черновики
        </button>
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Нет доступных тестов</p>
                {canCreate && (
                  <Link href="/dashboard/tests/create">
                    <Button variant="outline" className="mt-4">
                      Создать первый тест
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          tests.map((test) => (
            <TestCard 
              key={test.id} 
              test={test} 
              canEdit={canCreate}
            />
          ))
        )}
      </div>
    </div>
  );
}
