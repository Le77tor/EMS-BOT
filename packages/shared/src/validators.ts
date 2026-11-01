import { z } from 'zod';

// ==========================================
// Common Validators
// ==========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ==========================================
// User Validators
// ==========================================

export const userRoleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'HR_MANAGER',
  'HR_STAFF',
  'MODERATOR',
  'MEMBER',
]);

export const userStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'INACTIVE',
]);

export const updateUserSchema = z.object({
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

// ==========================================
// Application Validators
// ==========================================

export const applicationSchema = z.object({
  type: z.enum(['STAFF', 'PROMOTION', 'TRANSFER']),
  position: z.string().min(3).max(100),
  experience: z.string().min(50).max(5000),
  motivation: z.string().min(50).max(5000),
  references: z.string().max(1000).optional(),
});

export const reviewApplicationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().min(10).max(1000).optional(),
});

// ==========================================
// HR Stats Validators
// ==========================================

export const hrStatsSchema = z.object({
  interviews: z.number().int().min(0).max(999),
  hires: z.number().int().min(0).max(999),
  promotions: z.number().int().min(0).max(999),
  warnings: z.number().int().min(0).max(999),
  fires: z.number().int().min(0).max(999),
  trainings: z.number().int().min(0).max(999),
  notes: z.string().max(2000).optional(),
});

// ==========================================
// Post Validators
// ==========================================

export const postSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional().default('DRAFT'),
  type: z.enum(['ARTICLE', 'NEWS', 'ANNOUNCEMENT', 'GUIDE']).optional().default('ARTICLE'),
  categoryId: z.string().cuid().optional(),
  featured: z.boolean().optional().default(false),
});

export const updatePostSchema = postSchema.partial();

// ==========================================
// Test Validators
// ==========================================

export const questionSchema = z.object({
  question: z.string().min(10).max(1000),
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.any(),
  points: z.number().int().min(1).max(100).default(1),
  order: z.number().int().min(0).default(0),
});

export const testSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['KNOWLEDGE', 'PRACTICAL', 'CERTIFICATION']).default('KNOWLEDGE'),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().int().min(1).max(480).optional(),
  questions: z.array(questionSchema).min(1),
});

export const submitTestSchema = z.object({
  testId: z.string().cuid(),
  answers: z.record(z.any()),
});

// ==========================================
// Submission Validators
// ==========================================

export const submissionSchema = z.object({
  type: z.enum(['WEEKLY_REPORT', 'INCIDENT_REPORT', 'FEEDBACK', 'OTHER']),
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(50000),
  attachments: z.array(z.string()).optional(),
});

export const reviewSubmissionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'REVISION_NEEDED']),
  feedback: z.string().max(2000).optional(),
});

// ==========================================
// Config Validators
// ==========================================

export const configSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
  description: z.string().max(500).optional(),
});
