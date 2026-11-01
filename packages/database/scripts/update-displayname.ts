import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDisplayName() {
  try {
    console.log('🔄 Updating displayName for user with discordId: 1454149527983358156');
    
    const result = await prisma.user.update({
      where: {
        discordId: '1454149527983358156'
      },
      data: {
        displayName: 'Ass.DI | Lestor Hydrogen |221485'
      }
    });
    
    console.log('✅ Successfully updated:', result);
    console.log('New displayName:', result.displayName);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateDisplayName();
