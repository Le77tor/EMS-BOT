import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@majestic/database';

export async function POST(req: NextRequest) {
  try {
    console.log('[vacation-api] 📥 Received vacation application request');

    // Проверка авторизации
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('[vacation-api] ❌ Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[vacation-api] ✅ User authenticated:', session.user.id);

    // Получаем данные из запроса
    const body = await req.json();
    const { vacationType, startDate, endDate, reason } = body;

    console.log('[vacation-api] 📝 Application data:', { vacationType, startDate, endDate, reason });

    // Валидация
    if (!vacationType || !startDate || !endDate || !reason) {
      console.log('[vacation-api] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Проверка типа отпуска
    if (vacationType !== 'OOC' && vacationType !== 'IC') {
      console.log('[vacation-api] ❌ Invalid vacation type:', vacationType);
      return NextResponse.json(
        { error: 'Invalid vacation type. Must be OOC or IC' },
        { status: 400 }
      );
    }

    // Проверка дат
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log('[vacation-api] ❌ Invalid date format');
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (end < start) {
      console.log('[vacation-api] ❌ End date is before start date');
      return NextResponse.json(
        { error: 'End date cannot be before start date' },
        { status: 400 }
      );
    }

    // Создаем заявку в базе данных
    const application = await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'VACATION',
        status: 'PENDING',
        data: {
          vacationType,
          startDate,
          endDate,
          reason,
        },
      },
    });

    console.log('[vacation-api] ✅ Vacation application created:', application.id);

    // TODO: Отправить уведомление в Discord (если нужно)
    // await sendDiscordNotification(application);

    return NextResponse.json({
      success: true,
      applicationId: application.id,
    });
  } catch (error) {
    console.error('[vacation-api] ❌ Error creating vacation application:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
