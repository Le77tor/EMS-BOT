import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@majestic/database';

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const session = await getServerSession(authOptions);

    console.log('📊 Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      sessionData: session,
    });

    if (!session?.user?.id) {
      console.log('❌ Authorization failed: No session');
      return NextResponse.json(
        { error: 'Необходима авторизация через Discord' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, static: staticField, reason } = body;

    console.log('📊 Application submission:', {
      firstName,
      lastName,
      static: staticField,
      hasReason: !!reason,
      userId: session.user.id,
    });

    // Валидация
    if (!firstName || !lastName || !staticField || !reason) {
      console.log('❌ Validation failed: missing required fields');
      return NextResponse.json(
        { error: 'Все поля обязательны для заполнения' },
        { status: 400 }
      );
    }

    // Получаем Discord ID из базы данных
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { discordId: true }
    });

    if (!user?.discordId) {
      console.log('❌ Discord ID not found for user:', session.user.id);
      return NextResponse.json(
        { error: 'Discord ID не найден. Пожалуйста, авторизуйтесь заново.' },
        { status: 400 }
      );
    }

    console.log('✅ Found Discord ID:', user.discordId);

    // Проверяем, нет ли уже активной заявки или одобренной заявки от этого пользователя
    const existingApplication = await prisma.employmentApplication.findFirst({
      where: {
        discordId: user.discordId,
        status: {
          in: ['PENDING', 'IN_REVIEW', 'APPROVED']
        }
      }
    });

    if (existingApplication) {
      console.log('❌ Duplicate application detected for:', user.discordId);
      
      if (existingApplication.status === 'APPROVED') {
        return NextResponse.json(
          { error: 'У вас уже есть одобренная заявка. Вы уже являетесь сотрудником.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'У вас уже есть активная заявка на рассмотрении' },
        { status: 400 }
      );
    }

    // Сохранение в базу данных
    const application = await prisma.employmentApplication.create({
      data: {
        firstName,
        lastName,
        static: staticField,
        discordId: user.discordId,
        reason,
        status: 'PENDING',
        sentToDiscord: false,
        userJoinedGuild: false,
      },
    });

    console.log(`✅ Created application ${application.id} for user ${user.discordId}`);

    // Добавляем пользователя на Discord сервер
    try {
      const joinResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/discord/join-guild`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applicationId: application.id,
        }),
      });

      const joinData = await joinResponse.json();

      if (joinResponse.ok) {
        console.log(`✅ User ${user.discordId} added to guild`);
        
        // Обновляем заявку - пользователь добавлен на сервер
        await prisma.employmentApplication.update({
          where: { id: application.id },
          data: { userJoinedGuild: true },
        });

        console.log(`✅ Updated application ${application.id} - userJoinedGuild: true`);
      } else {
        console.log(`⚠️ Failed to add user to guild:`, joinData.error);
        // Не прерываем процесс - заявка всё равно создана
      }
    } catch (joinError) {
      console.error('⚠️ Error adding user to guild:', joinError);
      // Не прерываем процесс - заявка всё равно создана
    }

    return NextResponse.json({
      success: true,
      message: 'Заявление на трудоустройство успешно отправлено',
      application: {
        id: application.id,
        firstName: application.firstName,
        lastName: application.lastName,
      }
    });
  } catch (error) {
    console.error('❌ Error creating employment application:', error);
    return NextResponse.json(
      { error: 'Не удалось создать заявление' },
      { status: 500 }
    );
  }
}
