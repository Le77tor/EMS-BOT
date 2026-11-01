import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TestEditor } from '@/components/tests/test-editor';

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

export default async function CreateTestPage() {
  const session = await auth();
  
  if (!hasCreatorAccess(session?.user?.discordRoles)) {
    redirect('/dashboard/tests');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Новый тест</h1>
        <p className="text-muted-foreground mt-2">
          Вопросы, доступ, пауза между прохождениями и индивидуальное перемешивание.
        </p>
      </div>

      <TestEditor />
    </div>
  );
}
