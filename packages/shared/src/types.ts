// ==========================================
// Common Types
// ==========================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==========================================
// User Types
// ==========================================

export interface UserProfile {
  id: string;
  discordId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  HR_STAFF = 'HR_STAFF',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  INACTIVE = 'INACTIVE',
}

// ==========================================
// Permission Types
// ==========================================

export enum Permission {
  // User Management
  USER_VIEW = 'user.view',
  USER_EDIT = 'user.edit',
  USER_DELETE = 'user.delete',
  USER_BAN = 'user.ban',
  
  // Content Management
  POST_VIEW = 'post.view',
  POST_CREATE = 'post.create',
  POST_EDIT = 'post.edit',
  POST_DELETE = 'post.delete',
  POST_PUBLISH = 'post.publish',
  
  // Applications
  APPLICATION_VIEW = 'application.view',
  APPLICATION_REVIEW = 'application.review',
  APPLICATION_APPROVE = 'application.approve',
  
  // HR Management
  HR_STATS_VIEW = 'hr.stats.view',
  HR_STATS_EDIT = 'hr.stats.edit',
  HR_MANAGE = 'hr.manage',
  
  // Test Management
  TEST_VIEW = 'test.view',
  TEST_CREATE = 'test.create',
  TEST_EDIT = 'test.edit',
  TEST_DELETE = 'test.delete',
  TEST_TAKE = 'test.take',
  
  // Discord Integration
  DISCORD_MANAGE = 'discord.manage',
  
  // System
  SYSTEM_CONFIG = 'system.config',
  AUDIT_VIEW = 'audit.view',
}

export type RolePermissions = {
  [key in UserRole]: Permission[];
};

// ==========================================
// Application Types
// ==========================================

export interface ApplicationFormData {
  position: string;
  experience: string;
  motivation: string;
  references?: string;
}

export enum ApplicationType {
  STAFF = 'STAFF',
  PROMOTION = 'PROMOTION',
  TRANSFER = 'TRANSFER',
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// ==========================================
// HR Stats Types
// ==========================================

export interface HRStatsData {
  interviews: number;
  hires: number;
  promotions: number;
  warnings: number;
  fires: number;
  trainings: number;
  score: number;
}

export interface WeeklyStats extends HRStatsData {
  weekNumber: number;
  year: number;
  userId: string;
}

// ==========================================
// Discord Types
// ==========================================

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot?: boolean;
  system?: boolean;
}

export interface DiscordGuildMember {
  user: DiscordUser;
  nick: string | null;
  roles: string[];
  joinedAt: string;
}

// ==========================================
// Test Types
// ==========================================

export interface TestQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  points: number;
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ESSAY = 'ESSAY',
}

export interface TestAttemptData {
  testId: string;
  answers: Record<string, any>;
  startedAt: Date;
}

// ==========================================
// Submission Types
// ==========================================

export enum SubmissionType {
  WEEKLY_REPORT = 'WEEKLY_REPORT',
  INCIDENT_REPORT = 'INCIDENT_REPORT',
  FEEDBACK = 'FEEDBACK',
  OTHER = 'OTHER',
}

export enum SubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_NEEDED = 'REVISION_NEEDED',
}
