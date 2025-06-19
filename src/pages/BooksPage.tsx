import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { bookService } from '../services/educationalService';
import { useAuth } from '../context/AuthContext';
import type { Book, BookCreate } from '../types';

// Generate thumbnail based on book title
const generateBookThumbnail = (title: string) => {
  const colors = [
    'from-blue-500 to-blue-700',
    'from-purple-500 to-purple-700', 
    'from-green-500 to-green-700',
    'from-red-500 to-red-700',
    'from-yellow-500 to-yellow-700',
    'from-indigo-500 to-indigo-700',
    'from-pink-500 to-pink-700',
    'from-teal-500 to-teal-700'
  ];
  
  const colorIndex = title.length % colors.length;
  const color = colors[colorIndex];
  const initials = title.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  
  return { color, initials };
};

const BooksPage: React.FC = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState<BookCreate>({
    title: '',
    copies_owned: 1,
    tags: '',
    file_path: ''
  });

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const response = await bookService.getBooks(1, 100);
      setBooks(response.data);
    } catch (error) {
      toast.error('Failed to load books');
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.file_path.trim()) {
      toast.error('Title and file path are required');
      return;
    }

    try {
      setCreating(true);
      await bookService.createBook(formData);
      toast.success('Book created successfully!');
      setShowCreateModal(false);
      setFormData({
        title: '',
        copies_owned: 1,
        tags: '',
        file_path: ''
      });
      loadBooks();
    } catch (error) {
      toast.error('Failed to create book');
      console.error('Error creating book:', error);
    } finally {
      setCreating(false);
    }
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (book.tags && book.tags.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = ['all', ...new Set(books.flatMap(book => 
    book.tags ? book.tags.split(',').map(tag => tag.trim()) : []
  ))];

  const categoryFilteredBooks = selectedCategory === 'all' 
    ? filteredBooks 
    : filteredBooks.filter(book => 
        book.tags?.split(',').map(tag => tag.trim()).includes(selectedCategory)
      );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                📚 Books Library
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                {user?.role === 'student' 
                  ? 'Discover and explore educational books' 
                  : 'Manage and organize educational books'}
              </p>
            </div>
            {user && (user.role === 'instructor' || user.role === 'admin') && (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                ➕ Add New Book
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <Input
                    placeholder="Search books by title or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-blue-500 rounded-xl text-lg"
                  />
                </div>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Category Filter */}
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category === 'all' ? '📚 All Books' : `🏷️ ${category}`}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading amazing books...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Books Display */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {categoryFilteredBooks.map((book) => {
                  const thumbnail = generateBookThumbnail(book.title);
                  return (
                    <Card key={book.id} className="group overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white/90 backdrop-blur-sm border-0">
                      <div className="p-6 space-y-4">
                        {/* Book Thumbnail */}
                        <div className="aspect-[3/4] rounded-xl overflow-hidden relative">
                          <div className={`w-full h-full bg-gradient-to-br ${thumbnail.color} flex items-center justify-center text-white relative`}>
                            <div className="absolute inset-0 bg-black/10"></div>
                            <div className="relative z-10 text-center">
                              <div className="text-4xl font-bold mb-2">{thumbnail.initials}</div>
                              <div className="text-xs opacity-80">BOOK</div>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-white/20 backdrop-blur-sm rounded-full p-2">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        {/* Book Info */}
                        <div className="space-y-3">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                            {book.title}
                          </h3>
                          
                          {book.tags && (
                            <div className="flex flex-wrap gap-1">
                              {book.tags.split(',').map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              {book.copies_owned} copies
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 space-y-2">
                            <Button 
                              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg py-2 transform hover:scale-105 transition-all duration-200"
                              onClick={() => toast.success('Reading feature coming soon!')}
                            >
                              📖 Read Now
                            </Button>
                            
                            {user && (user.role === 'instructor' || user.role === 'admin') && (
                              <div className="flex space-x-2">
                                <Button 
                                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm"
                                  onClick={() => toast.success('Edit feature coming soon!')}
                                >
                                  ✏️ Edit
                                </Button>
                                <Button 
                                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg py-2 text-sm"
                                  onClick={() => toast.error('Delete feature coming soon!')}
                                >
                                  🗑️ Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // List View
              <div className="space-y-4">
                {categoryFilteredBooks.map((book) => {
                  const thumbnail = generateBookThumbnail(book.title);
                  return (
                    <Card key={book.id} className="p-6 hover:shadow-lg transition-all duration-200 bg-white/90 backdrop-blur-sm border-0">
                      <div className="flex items-center space-x-6">
                        {/* Thumbnail */}
                        <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0">
                          <div className={`w-full h-full bg-gradient-to-br ${thumbnail.color} flex items-center justify-center text-white`}>
                            <div className="text-lg font-bold">{thumbnail.initials}</div>
                          </div>
                        </div>
                        
                        {/* Book Info */}
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-xl mb-2">{book.title}</h3>
                          {book.tags && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {book.tags.split(',').map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-gray-500 text-sm">{book.copies_owned} copies available</p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex space-x-3">
                          <Button 
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-lg"
                            onClick={() => toast.success('Reading feature coming soon!')}
                          >
                            📖 Read Now
                          </Button>
                          
                          {user && (user.role === 'instructor' || user.role === 'admin') && (
                            <>
                              <Button 
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                                onClick={() => toast.success('Edit feature coming soon!')}
                              >
                                ✏️ Edit
                              </Button>
                              <Button 
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg"
                                onClick={() => toast.error('Delete feature coming soon!')}
                              >
                                🗑️ Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {categoryFilteredBooks.length === 0 && (
              <div className="text-center py-20">
                <div className="text-8xl mb-4">📚</div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">No books found</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery ? 'Try adjusting your search terms' : 'No books have been added yet'}
                </p>
                {user && (user.role === 'instructor' || user.role === 'admin') && (
                  <Button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl"
                  >
                    ➕ Add Your First Book
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {/* Create Book Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Add New Book</h2>
                <form onSubmit={handleCreateBook} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="Enter book title"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File Path *
                    </label>
                    <Input
                      value={formData.file_path}
                      onChange={(e) => setFormData({...formData, file_path: e.target.value})}
                      placeholder="Enter file path or URL"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags
                    </label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                      placeholder="Enter tags separated by commas"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Copies Owned
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.copies_owned}
                      onChange={(e) => setFormData({...formData, copies_owned: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <Button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={creating}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {creating ? 'Creating...' : 'Create Book'}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default BooksPage;
