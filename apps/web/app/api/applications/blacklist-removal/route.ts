import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@majestic/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { firstName, lastName, static: staticField, discordId, blacklistReason, removalReason } = body;

    // Валидация
    if (!firstName || !lastName || !staticField || !discordId || !blacklistReason || !removalReason) {
      return NextResponse.json(
        { error: 'Все поля обязательны для заполнения' },
        { status: 400 }
      );
    }

    // Проверка блокировки по статику
    const block = await prisma.blacklistRemovalBlock.findFirst({
      where: {
        static: staticField,
        isActive: true,
      },
    });

    if (block) {
      return NextResponse.json(
        { 
          error: 'Вам запрещено подавать заявки на вынесение из черного списка',
          blocked: true 
        },
        { status: 403 }
      );
    }

    // Сохранение в базу данных
    const application = await prisma.blacklistRemoval.create({
      data: {
        firstName,
        lastName,
        static: staticField,
        discordId,
        blacklistReason,
        removalReason,
        status: 'PENDING',
        sentToDiscord: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Заявление успешно отправлено',
      applicationId: application.id,
    });
  } catch (error) {
    console.error('Error creating blacklist removal application:', error);
    return NextResponse.json(
      { error: 'Не удалось создать заявление' },
      { status: 500 }
    );
  }
}
