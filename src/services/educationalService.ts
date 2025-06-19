import { educationalPlatformApi } from './apiClient';
import type {
  Book,
  BookCreate,
  Video,
  VideoCreate,
  AIEvaluation,
  AIEvaluationRequest,
  PaginatedResponse
} from '../types';

export class BookService {
  async getBooks(page = 1, limit = 10, _category?: string): Promise<PaginatedResponse<Book>> {
    const books = await educationalPlatformApi.get<Book[]>('/api/v1/books/available');
    
    // Client-side pagination since API doesn't support it
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBooks = books.slice(startIndex, endIndex);
    
    return {
      data: paginatedBooks,
      page,
      limit,
      total: books.length,
      totalPages: Math.ceil(books.length / limit)
    };
  }
  async getBook(bookId: number | string): Promise<Book> {
    // Get all books and find the specific one (since there's no individual book endpoint)
    const books = await educationalPlatformApi.get<Book[]>('/api/v1/books/available');
    const book = books.find(b => b.id === Number(bookId));
    if (!book) {
      throw new Error('Book not found');
    }
    return book;
  }

  async createBook(bookData: BookCreate): Promise<Book> {
    return await educationalPlatformApi.post<Book>('/api/v1/books/upload', bookData);
  }  async updateBook(_bookId: number | string, _bookData: Partial<Book>): Promise<Book> {
    // This endpoint doesn't exist in the API, so we'll throw an error
    throw new Error('Update book functionality not available in the API');
  }

  async deleteBook(_bookId: number | string): Promise<void> {
    // This endpoint doesn't exist in the API, so we'll throw an error
    throw new Error('Delete book functionality not available in the API');
  }

  async searchBooks(query: string): Promise<Book[]> {
    return await educationalPlatformApi.get<Book[]>('/api/v1/books/search', { params: { query } });
  }

  async getActiveRentals(): Promise<any[]> {
    return await educationalPlatformApi.get<any[]>('/api/v1/books/active');
  }

  async getBookCategories(): Promise<string[]> {
    // Since API doesn't have a categories endpoint, return common categories
    return ['Programming', 'Mathematics', 'Science', 'Literature', 'History', 'Business'];
  }
}

export class VideoService {  async getVideos(page = 1, limit = 10, category?: string): Promise<PaginatedResponse<Video>> {
    const params: any = {};
    if (category) {
      params.subject = category; // API uses 'subject' instead of 'category'
    }
    
    const videos = await educationalPlatformApi.get<Video[]>('/api/v1/video-lectures', { params });
    
    // Client-side pagination since API doesn't support it
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    return {
      data: paginatedVideos,
      page,
      limit,
      total: videos.length,
      totalPages: Math.ceil(videos.length / limit)
    };
  }

  async getVideo(videoId: number | string): Promise<Video> {
    return await educationalPlatformApi.get<Video>(`/api/v1/video-lectures/${videoId}`);
  }

  async createVideo(videoData: VideoCreate): Promise<Video> {
    return await educationalPlatformApi.post<Video>('/api/v1/video-lectures', videoData);
  }
  async updateVideo(_videoId: number | string, _videoData: Partial<Video>): Promise<Video> {
    // This endpoint doesn't exist in the API, so we'll throw an error
    throw new Error('Update video functionality not available in the API');
  }

  async deleteVideo(videoId: number | string): Promise<void> {
    await educationalPlatformApi.delete(`/api/v1/video-lectures/${videoId}`);
  }

  async getTeacherVideos(): Promise<Video[]> {
    return await educationalPlatformApi.get<Video[]>('/api/v1/video-lectures/teacher/lectures');
  }
  async getVideoCategories(): Promise<string[]> {
    // Since API doesn't have a categories endpoint, return common subjects
    return ['Programming', 'Web Development', 'Data Science', 'AI/ML', 'DevOps', 'Mobile Development'];
  }
}

export class AIEvaluationService {
  async createEvaluation(request: AIEvaluationRequest): Promise<AIEvaluation> {
    return await educationalPlatformApi.post<AIEvaluation>('/api/v1/evaluators/', request);
  }

  async getEvaluations(page = 1, limit = 10): Promise<PaginatedResponse<AIEvaluation>> {
    const response = await educationalPlatformApi.get<{items: AIEvaluation[], total: number, skip: number, limit: number, has_more: boolean}>('/api/v1/evaluators/list', {
      params: { 
        skip: (page - 1) * limit, 
        limit 
      }
    });
    
    return {
      data: response.items,
      page,
      limit,
      total: response.total,
      totalPages: Math.ceil(response.total / limit)
    };
  }

  async getEvaluation(evaluationId: number | string): Promise<AIEvaluation> {
    return await educationalPlatformApi.get<AIEvaluation>(`/api/v1/evaluators/${evaluationId}/view`);
  }

  async updateEvaluation(evaluationId: number | string, evaluationData: Partial<AIEvaluation>): Promise<AIEvaluation> {
    return await educationalPlatformApi.put<AIEvaluation>(`/api/v1/evaluators/${evaluationId}`, evaluationData);
  }

  async deleteEvaluation(evaluationId: number | string): Promise<void> {
    await educationalPlatformApi.delete(`/api/v1/evaluators/${evaluationId}`);
  }

  async submitEvaluation(evaluationId: number | string, submissionData: { submission_content: string }): Promise<any> {
    return await educationalPlatformApi.post(`/api/v1/evaluators/${evaluationId}/submit`, submissionData);
  }

  async getEvaluationStatus(evaluationId: number | string): Promise<any> {
    return await educationalPlatformApi.get(`/api/v1/evaluators/${evaluationId}/status`);
  }

  async getEvaluationResults(evaluationId: number | string): Promise<any[]> {
    return await educationalPlatformApi.get<any[]>(`/api/v1/evaluators/${evaluationId}/result`);
  }

  async triggerAutoEvaluation(evaluationId: number | string, submissionId: number | string): Promise<{
    message: string;
    provisional_grade: number;
    feedback: string;
  }> {
    return await educationalPlatformApi.post(`/api/v1/evaluators/${evaluationId}/evaluate`, {
      submission_id: submissionId
    });
  }

  async gradeSubmission(evaluationId: number | string, submissionId: number | string, gradeData: {
    grade: number;
    feedback: string;
  }): Promise<any> {
    return await educationalPlatformApi.put(`/api/v1/evaluators/${evaluationId}/submissions/${submissionId}/grade`, gradeData);
  }

  async getSubmissions(evaluationId: number | string): Promise<any[]> {
    return await educationalPlatformApi.get<any[]>(`/api/v1/evaluators/${evaluationId}/submissions`);
  }
}

export const bookService = new BookService();
export const videoService = new VideoService();
export const aiEvaluationService = new AIEvaluationService();
