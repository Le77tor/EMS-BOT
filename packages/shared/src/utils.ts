import { Permission, UserRole } from './types';

// ==========================================
// Role Permissions
// ==========================================

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  
  [UserRole.ADMIN]: [
    Permission.USER_VIEW,
    Permission.USER_EDIT,
    Permission.USER_BAN,
    Permission.POST_VIEW,
    Permission.POST_CREATE,
    Permission.POST_EDIT,
    Permission.POST_DELETE,
    Permission.POST_PUBLISH,
    Permission.APPLICATION_VIEW,
    Permission.APPLICATION_REVIEW,
    Permission.APPLICATION_APPROVE,
    Permission.HR_STATS_VIEW,
    Permission.HR_STATS_EDIT,
    Permission.HR_MANAGE,
    Permission.TEST_VIEW,
    Permission.TEST_CREATE,
    Permission.TEST_EDIT,
    Permission.TEST_DELETE,
    Permission.DISCORD_MANAGE,
    Permission.AUDIT_VIEW,
  ],
  
  [UserRole.HR_MANAGER]: [
    Permission.USER_VIEW,
    Permission.POST_VIEW,
    Permission.POST_CREATE,
    Permission.POST_EDIT,
    Permission.APPLICATION_VIEW,
    Permission.APPLICATION_REVIEW,
    Permission.APPLICATION_APPROVE,
    Permission.HR_STATS_VIEW,
    Permission.HR_STATS_EDIT,
    Permission.HR_MANAGE,
    Permission.TEST_VIEW,
    Permission.TEST_CREATE,
    Permission.TEST_EDIT,
    Permission.TEST_TAKE,
  ],
  
  [UserRole.HR_STAFF]: [
    Permission.USER_VIEW,
    Permission.POST_VIEW,
    Permission.APPLICATION_VIEW,
    Permission.HR_STATS_VIEW,
    Permission.TEST_VIEW,
    Permission.TEST_TAKE,
  ],
  
  [UserRole.MODERATOR]: [
    Permission.USER_VIEW,
    Permission.USER_BAN,
    Permission.POST_VIEW,
    Permission.POST_CREATE,
    Permission.POST_EDIT,
    Permission.APPLICATION_VIEW,
    Permission.AUDIT_VIEW,
  ],
  
  [UserRole.MEMBER]: [
    Permission.USER_VIEW,
    Permission.POST_VIEW,
    Permission.TEST_VIEW,
    Permission.TEST_TAKE,
  ],
};

// ==========================================
// Pagination
// ==========================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ==========================================
// Time Constants
// ==========================================

export const MILLISECONDS_IN_SECOND = 1000;
export const SECONDS_IN_MINUTE = 60;
export const MINUTES_IN_HOUR = 60;
export const HOURS_IN_DAY = 24;

export const MILLISECONDS_IN_MINUTE = MILLISECONDS_IN_SECOND * SECONDS_IN_MINUTE;
export const MILLISECONDS_IN_HOUR = MILLISECONDS_IN_MINUTE * MINUTES_IN_HOUR;
export const MILLISECONDS_IN_DAY = MILLISECONDS_IN_HOUR * HOURS_IN_DAY;

// ==========================================
// Discord Colors
// ==========================================

export const DISCORD_COLORS = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffff00,
  INFO: 0x0099ff,
  PRIMARY: 0x5865f2,
} as const;

// ==========================================
// Test Constants
// ==========================================

export const DEFAULT_PASSING_SCORE = 70;
export const DEFAULT_TEST_TIME_LIMIT = 60; // minutes

// ==========================================
// HR Stats Constants
// ==========================================

export const HR_METRICS = {
  INTERVIEW: { label: 'Собеседование', points: 1 },
  HIRE: { label: 'Прием на работу', points: 3 },
  PROMOTION: { label: 'Повышение', points: 2 },
  WARNING: { label: 'Выговор', points: -1 },
  FIRE: { label: 'Увольнение', points: 1 },
  TRAINING: { label: 'Обучение', points: 2 },
} as const;
