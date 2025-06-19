import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomService, codeEditorService } from '../services/codeEditorService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/CommonComponents';
import { toast } from 'react-hot-toast';
import type { Room } from '../types';

interface LanguageInfo {
  language: string;
  displayName: string;
  version: string;
  tier: string;
  description: string;
  extensions: string[];
}

const RoomsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [newRoom, setNewRoom] = useState({
    roomName: '',
    languages: ['python'],
    maxUsers: 5,
  });

  useEffect(() => {
    fetchRooms();
    loadAvailableLanguages();
  }, []);
  const loadAvailableLanguages = async () => {
    setIsLoadingLanguages(true);
    try {
      const response = await codeEditorService.getAvailableLanguages();
      setAvailableLanguages(response.availableLanguages);
      
      // Set all available languages as default selection for room creation
      const allLanguages = response.availableLanguages.map(lang => lang.language);
      setNewRoom(prev => ({
        ...prev,
        languages: allLanguages
      }));
    } catch (error: any) {
      console.error('Failed to load available languages:', error);
      toast.error('Failed to load available languages');      // Fallback to basic languages
      const fallbackLanguages = [
        { language: 'python', displayName: 'Python', version: 'latest', tier: 'low', description: 'Python runtime', extensions: ['.py'] },
        { language: 'javascript', displayName: 'JavaScript (Node.js)', version: 'latest', tier: 'low', description: 'JavaScript runtime', extensions: ['.js'] },
        { language: 'go', displayName: 'Go', version: 'latest', tier: 'low', description: 'Go runtime', extensions: ['.go'] },
        { language: 'cpp', displayName: 'C++', version: 'latest', tier: 'medium', description: 'C++ runtime', extensions: ['.cpp'] },
        { language: 'java', displayName: 'Java', version: 'latest', tier: 'medium', description: 'Java runtime', extensions: ['.java'] }
      ];
      setAvailableLanguages(fallbackLanguages);
      
      // Set all fallback languages as default selection
      const allFallbackLanguages = fallbackLanguages.map(lang => lang.language);
      setNewRoom(prev => ({
        ...prev,
        languages: allFallbackLanguages
      }));
    } finally {
      setIsLoadingLanguages(false);
    }
  };  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching rooms...', { searchTerm });
      const response = await roomService.getRooms(1, 20, searchTerm);
      console.log('Rooms response:', response);
      setRooms(response.data);
    } catch (error: any) {
      console.error('Failed to fetch rooms:', error);
        // Add mock data for testing if API fails
      const mockRooms = [
        {
          id: 'mock-room-1',
          roomId: 'mock-room-1',
          roomName: 'Python Study Group',
          name: 'Python Study Group',
          languages: ['python', 'javascript'],
          maxUsers: 5,
          currentUsers: 2,
          containerId: 'container-1',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          createdBy: 'user-1',
          isActive: true,
          participantCount: 2,
          description: 'A collaborative Python learning room',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          resourceTier: 'pro'
        },
        {
          id: 'mock-room-2',
          roomId: 'mock-room-2',
          roomName: 'JavaScript Workshop',
          name: 'JavaScript Workshop',
          languages: ['javascript', 'typescript'],
          maxUsers: 8,
          currentUsers: 3,
          containerId: 'container-2',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          createdBy: 'user-2',
          isActive: true,
          participantCount: 3,
          description: 'JavaScript and TypeScript workshop',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          resourceTier: 'pro'
        }
      ];
      
      // Show mock data when API fails (for testing)
      if (import.meta.env.DEV) {
        console.log('Using mock rooms for development');
        setRooms(mockRooms);
        toast.error('API connection failed, showing mock data');
      } else {
        setRooms([]);
        toast.error('Failed to fetch rooms');
      }
    } finally {
      setIsLoading(false);
    }
  };const createRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const result = await roomService.createRoom({
        roomName: newRoom.roomName,
        languages: newRoom.languages,
        maxUsers: newRoom.maxUsers,
      });      if (result.success) {
        toast.success('Room created successfully!');
        setShowCreateModal(false);
        
        // Reset room state with all available languages selected
        const allLanguages = availableLanguages.map(lang => lang.language);
        setNewRoom({
          roomName: '',
          languages: allLanguages,
          maxUsers: 5,
        });
        
        // Redirect to the new room or refresh the list
        fetchRooms();
      }
    } catch (error: any) {
      console.error('Room creation error:', error);
      const errorMessage = error.message || 'Failed to create room';
      
      // Provide helpful error messages
      if (errorMessage.includes('docker') || errorMessage.includes('ENOENT')) {
        toast.error('Docker is not running or not properly configured. Please ensure Docker Desktop is running.');
      } else {        toast.error(errorMessage);
      }    } finally {
      setIsCreatingRoom(false);
    }
  };  const resetRoomForm = () => {
    const allLanguages = availableLanguages.map(lang => lang.language);
    setNewRoom({
      roomName: '',
      languages: allLanguages,
      maxUsers: 5,
    });
  };

  const handleJoinRoom = async (roomId: string) => {    try {
      toast.loading('Joining room...');
      await roomService.joinRoom(roomId);
      toast.dismiss();
      toast.success('Successfully joined room!');
      
      // Navigate to the room collaboration page
      navigate(`/rooms/${roomId}`);
    } catch (error: any) {
      toast.dismiss();
      console.error('Failed to join room:', error);
      toast.error(error.message || 'Failed to join room');
    }
  };
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    // Debounce the search to avoid too many API calls
    setTimeout(() => {
      if (value === searchTerm) {
        fetchRooms();
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600">Loading rooms...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.role === 'student' ? 'Join Collaboration Rooms' : 'Manage Collaboration Rooms'}
          </h1>
          <p className="mt-2 text-gray-600">
            {user?.role === 'student' 
              ? 'Join coding rooms to collaborate with others in real-time'
              : 'Create and manage coding rooms for collaborative learning'}
          </p>
        </div>
        {user && (user.role === 'instructor' || user.role === 'admin') && (
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Room
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">              <Input
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <Button variant="outline" onClick={fetchRooms}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>      {/* Rooms Grid */}
      {rooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room: any) => (
            <Card key={room.roomId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{room.roomName}</CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        room.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {room.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {room.currentUsers}/{room.maxUsers} users
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Languages */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Languages:</h4>
                    <div className="flex flex-wrap gap-1">
                      {room.languages.map((lang: string) => (
                        <span
                          key={lang}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1" 
                      size="sm"
                      disabled={room.currentUsers >= room.maxUsers}
                      onClick={() => handleJoinRoom(room.roomId)}
                    >
                      {room.currentUsers >= room.maxUsers ? 'Full' : 'Join Room'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(room.roomId);
                        toast.success('Room ID copied to clipboard!');
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms available</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? 'No rooms match your search criteria.' 
                  : 'Be the first to create a collaboration room!'
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowCreateModal(true)}>
                  Create Your First Room
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Room</h3>                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetRoomForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Room Name"
                  value={newRoom.roomName}
                  onChange={(e) => setNewRoom({ ...newRoom, roomName: e.target.value })}
                  placeholder="Enter room name"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Programming Languages
                  </label>                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {isLoadingLanguages ? (
                      <div className="text-sm text-gray-500">Loading languages...</div>
                    ) : (
                      availableLanguages.map((lang) => (
                        <label key={lang.language} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newRoom.languages.includes(lang.language)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRoom({
                                  ...newRoom,
                                  languages: [...newRoom.languages, lang.language]
                                });
                              } else {
                                setNewRoom({
                                  ...newRoom,
                                  languages: newRoom.languages.filter(l => l !== lang.language)
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {lang.displayName} {lang.tier !== 'low' && `(${lang.tier})`}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Users
                  </label>
                  <select
                    value={newRoom.maxUsers}
                    onChange={(e) => setNewRoom({ ...newRoom, maxUsers: parseInt(e.target.value) })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    {[2, 3, 4, 5, 6, 8, 10].map(num => (
                      <option key={num} value={num}>{num} users</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetRoomForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createRoom}
                  isLoading={isCreatingRoom}
                  disabled={!newRoom.roomName || newRoom.languages.length === 0}
                  className="flex-1"
                >
                  Create Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsPage;
