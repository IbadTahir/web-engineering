// User Management API Types
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'instructor' | 'admin';
  tier?: 'free' | 'pro' | 'enterprise';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: 'student' | 'instructor';
}

// Code Editor API Types
export interface CodeSession {
  id: string;
  sessionId: string;
  sessionType: 'solo' | 'room';
  roomId?: string;
  roomName?: string;
  code: string;
  language: string;
  languages?: string[];
  status: 'active' | 'inactive' | 'terminated';
  containerId?: string;
  maxUsers?: number;
  currentUsers?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionResult {
  output: string;
  error: string | null;
  executionTime: number;
  sessionId: string;
}

export interface ExecuteCodeRequest {
  sessionId: string;
  code: string;
  language: string;
  filename?: string;
}

export interface ExecuteCodeResponse {
  output: string;
  error?: string;
  executionTime: number;
}

export interface Room {
  id: string;
  roomId: string;
  roomName: string;
  name: string;
  languages: string[];
  maxUsers: number;
  currentUsers: number;
  containerId?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastActivity?: string;
  createdBy: string;
  isActive: boolean;
  participantCount: number;
  description?: string;
  expiresAt?: string;
  resourceTier?: string;
}

export interface RoomParticipant {
  userId: string;
  username: string;
  joinedAt: string;
  isOwner: boolean;
  status: 'active' | 'inactive';
}

export interface SessionInitRequest {
  sessionType: 'solo' | 'room';
  language?: string;
  languages?: string[];
  roomName?: string;
  maxUsers?: number;
}

// Educational Platform API Types
export interface Book {
  id: number;
  title: string;
  copies_owned: number;
  copies_available: number;
  tags: string;
  file_path?: string;
  created_at: string;
}

export interface BookCreate {
  title: string;
  copies_owned: number;
  tags: string;
  file_path: string;
}

export interface Video {
  id: number;
  title: string;
  description: string;
  video_url: string;
  subject: string;
  topic: string;
  notes_url?: string;
  teacher_username?: string;
  created_at: string;
}

export interface VideoCreate {
  title: string;
  description: string;
  video_url: string;
  subject: string;
  topic: string;
  notes_url?: string;
}

export interface AIEvaluation {
  id: number;
  title: string;
  description: string;
  type: 'quiz' | 'assignment';
  submission_type: 'text' | 'image' | 'video' | 'code';
  is_auto_eval: boolean;
  deadline?: string;
  max_attempts: number;
  quiz_type?: 'multiple_choice' | 'open_ended' | 'code_evaluation' | 'essay' | 'coding';
  quiz_data?: any;
  created_at: string;
}

export interface AIEvaluationRequest {
  title: string;
  description: string;
  type: 'quiz' | 'assignment';
  submission_type: 'text' | 'image' | 'video' | 'code';
  is_auto_eval: boolean;
  deadline?: string;
  max_attempts?: number;
  quiz_type?: 'multiple_choice' | 'open_ended' | 'code_evaluation' | 'essay' | 'coding';
  quiz_data?: any;
}

// Common API Response Types
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}
