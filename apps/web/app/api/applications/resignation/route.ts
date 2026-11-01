import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@majestic/database';

export async function POST(req: NextRequest) {
  try {
    console.log('[resignation-api] 📥 Received resignation application request');

    // Проверка авторизации
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('[resignation-api] ❌ Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[resignation-api] ✅ User authenticated:', session.user.id);

    // Получаем данные из запроса
    const body = await req.json();
    const { reason, agreedToBlacklist } = body;

    console.log('[resignation-api] 📝 Application data:', { reason, agreedToBlacklist });

    // Валидация
    if (!reason || typeof reason !== 'string') {
      console.log('[resignation-api] ❌ Missing or invalid reason');
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      );
    }

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      console.log('[resignation-api] ❌ Reason too short');
      return NextResponse.json(
        { error: 'Reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (trimmedReason.length > 1000) {
      console.log('[resignation-api] ❌ Reason too long');
      return NextResponse.json(
        { error: 'Reason must not exceed 1000 characters' },
        { status: 400 }
      );
    }

    // Проверяем, нет ли уже активной заявки на увольнение
    const existingApplication = await prisma.application.findFirst({
      where: {
        userId: session.user.id,
        type: 'RESIGNATION',
        status: {
          in: ['PENDING', 'REVIEWED'],
        },
      },
    });

    if (existingApplication) {
      console.log('[resignation-api] ❌ User already has active resignation application');
      return NextResponse.json(
        { error: 'У вас уже есть активное заявление на увольнение' },
        { status: 400 }
      );
    }

    // Создаем заявку в базе данных
    const application = await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'RESIGNATION',
        status: 'PENDING',
        data: {
          reason: trimmedReason,
          agreedToBlacklist: agreedToBlacklist || false, // Флаг согласия с ЧС
        },
      },
    });

    console.log('[resignation-api] ✅ Resignation application created:', application.id);

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message: 'Заявление на увольнение успешно отправлено. Ожидайте рассмотрения.',
    });
  } catch (error) {
    console.error('[resignation-api] ❌ Error creating resignation application:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
