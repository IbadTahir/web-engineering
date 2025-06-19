import React, { useState, useEffect, useRef } from 'react';
import { codeEditorService } from '../services/codeEditorService';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { toast } from 'react-hot-toast';
import type { CodeSession, SessionInitRequest } from '../types';

interface LanguageInfo {
  language: string;
  displayName: string;
  version: string;
  tier: string;
  description: string;
  extensions: string[];
}

const CodeEditorPage: React.FC = () => {
  const [session, setSession] = useState<CodeSession | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [code, setCode] = useState('# Welcome to the Code Editor\nprint("Hello, World!")');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [filename, setFilename] = useState('main.py');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState(14);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Language templates
  const languageTemplates: Record<string, string> = {
    python: '# Welcome to Python\nprint("Hello, World!")',
    javascript: '// Welcome to JavaScript\nconsole.log("Hello, World!");',
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
    cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    rust: 'fn main() {\n    println!("Hello, World!");\n}'
  };

  const getLanguageIcon = (language: string): string => {
    const icons: Record<string, string> = {
      python: '🐍',
      javascript: '🟨',
      go: '🔵',
      cpp: '⚡',
      java: '☕',
      rust: '🦀'
    };
    return icons[language] || '📝';
  };

  const getFileExtension = (language: string): string => {
    const extensionMap: Record<string, string> = {
      python: '.py',
      javascript: '.js',
      go: '.go',
      cpp: '.cpp',
      java: '.java',
      rust: '.rs'
    };
    return extensionMap[language] || '.txt';
  };

  useEffect(() => {
    loadAvailableLanguages();
  }, []);
  const loadAvailableLanguages = async () => {
    try {
      setIsLoadingLanguages(true);
      const response = await codeEditorService.getAvailableLanguages();
      setAvailableLanguages(response.availableLanguages);
    } catch (error) {
      toast.error('Failed to load supported languages');
      console.error('Error loading languages:', error);
    } finally {
      setIsLoadingLanguages(false);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    setCode(languageTemplates[language] || '// Start coding...');
    setFilename(`main${getFileExtension(language)}`);
    setOutput('');
    setError('');
    
    if (session) {
      terminateSession();
    }
  };  const createSession = async () => {
    if (!selectedLanguage) {
      toast.error('Please select a language first');
      return;
    }

    try {
      setIsCreatingSession(true);
      const request: SessionInitRequest = {
        sessionType: 'solo',
        language: selectedLanguage
      };
      const newSession = await codeEditorService.initializeSession(request);
      setSession(newSession);
      toast.success(`${selectedLanguage} session created successfully!`);
    } catch (error) {
      toast.error('Failed to create coding session');
      console.error('Error creating session:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const terminateSession = async () => {
    if (!session) return;

    try {
      await codeEditorService.terminateSession(session.sessionId);
      setSession(null);
      setOutput('');
      setError('');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      toast.success('Session terminated');
    } catch (error) {
      toast.error('Failed to terminate session');
      console.error('Error terminating session:', error);
    }
  };
  const executeCode = async () => {
    if (!session || !code.trim()) {
      if (!session) {
        toast.error('Please create a session first');
        return;
      }
      toast.error('Please enter some code to execute');
      return;
    }

    try {
      setIsExecuting(true);
      setOutput('');
      setError('');
      
      const startTime = Date.now();
      const request = {
        code,
        language: selectedLanguage,
        filename
      };
      const result = await codeEditorService.executeCode(session.sessionId, request);
      const executionTime = Date.now() - startTime;
      
      if (result.error) {
        setError(result.error);
        toast.error('Code execution failed');
      } else {
        setOutput(result.output || 'Code executed successfully (no output)');
        toast.success(`Code executed in ${executionTime}ms`);
      }
    } catch (error) {
      setError('Failed to execute code. Please try again.');
      toast.error('Execution error');
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeCode();
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-gray-100' 
    : 'bg-white text-gray-900';

  const editorThemeClasses = theme === 'dark'
    ? 'bg-gray-800 text-gray-100 border-gray-700'
    : 'bg-white text-gray-900 border-gray-300';

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-200`}>
      {/* VS Code-like Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-gray-300 text-sm font-medium">
            💻 Code Editor - {filename}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            ⚙️
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-3rem)]">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col">
          {/* Language Selection */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              🌍 Languages
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.language}
                  onClick={() => handleLanguageChange(lang.language)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedLanguage === lang.language
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getLanguageIcon(lang.language)}</span>
                    <div>
                      <div className="font-medium">{lang.displayName}</div>
                      <div className="text-xs opacity-70">{lang.version}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Session Controls */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              🔧 Session
            </h3>
            <div className="space-y-2">
              {!session ? (
                <Button
                  onClick={createSession}
                  disabled={isCreatingSession}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {isCreatingSession ? '⏳ Creating...' : '🚀 Start Session'}
                </Button>
              ) : (
                <>
                  <div className="bg-green-900 border border-green-700 p-3 rounded-lg">
                    <div className="text-green-400 text-sm font-medium">
                      ✅ Session Active
                    </div>
                    <div className="text-green-300 text-xs">
                      {session.language} • {session.sessionId.slice(0, 8)}
                    </div>
                  </div>
                  <Button
                    onClick={terminateSession}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    🛑 Stop Session
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* File Explorer Placeholder */}
          <div className="p-4 flex-1">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              📁 Explorer
            </h3>
            <div className="text-gray-400 text-sm">
              <div className="flex items-center space-x-2 py-1">
                <span>📄</span>
                <span>{filename}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-t border-gray-700">
            <div className="text-gray-400 text-xs space-y-1">
              <div>Language: {selectedLanguage}</div>
              <div>Theme: {theme}</div>
              <div>Font: {fontSize}px</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center">
            <div className="flex">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-2 text-sm border-r border-gray-700 transition-colors ${
                  activeTab === 'editor'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <span className="mr-2">{getLanguageIcon(selectedLanguage)}</span>
                {filename}
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex">
            <div className="flex-1 p-4">
              <Card className={`h-full ${editorThemeClasses} border-0 shadow-2xl`}>
                <div className="h-full flex flex-col">
                  {/* Editor Header */}
                  <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getLanguageIcon(selectedLanguage)}</span>
                      <span className="font-medium">{selectedLanguage.toUpperCase()} Editor</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        Ctrl+Enter to run
                      </span>
                      <Button
                        onClick={executeCode}
                        disabled={!session || isExecuting}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                      >
                        {isExecuting ? '⏳ Running...' : '▶️ Run'}
                      </Button>
                    </div>
                  </div>

                  {/* Code Editor */}
                  <div className="flex-1 p-0">
                    <textarea
                      ref={textareaRef}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className={`w-full h-full resize-none font-mono p-4 focus:outline-none ${editorThemeClasses} border-0`}
                      style={{ fontSize: `${fontSize}px`, lineHeight: '1.5' }}
                      placeholder="Start coding..."
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Output Panel */}
            <div className="w-1/3 p-4 pl-0">
              <Card className={`h-full ${editorThemeClasses} border-0 shadow-2xl`}>
                <div className="h-full flex flex-col">
                  {/* Output Header */}
                  <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <span className="font-medium">📊 Output</span>
                    <button
                      onClick={() => {
                        setOutput('');
                        setError('');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-300"
                    >
                      🗑️ Clear
                    </button>
                  </div>

                  {/* Output Content */}
                  <div className="flex-1 p-4 overflow-auto">
                    {isExecuting ? (
                      <div className="flex items-center space-x-2 text-blue-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                        <span>Executing code...</span>
                      </div>
                    ) : (
                      <>
                        {output && (
                          <div className="mb-4">
                            <div className="text-green-400 text-sm font-medium mb-2">✅ Output:</div>
                            <pre className="text-sm bg-gray-800 p-3 rounded-lg overflow-auto">
                              {output}
                            </pre>
                          </div>
                        )}
                        
                        {error && (
                          <div className="mb-4">
                            <div className="text-red-400 text-sm font-medium mb-2">❌ Error:</div>
                            <pre className="text-sm bg-red-900/20 border border-red-700 p-3 rounded-lg overflow-auto text-red-300">
                              {error}
                            </pre>
                          </div>
                        )}
                        
                        {!output && !error && !isExecuting && (
                          <div className="text-gray-500 text-sm text-center py-8">
                            <div className="text-4xl mb-2">🚀</div>
                            <div>Run your code to see output here</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">⚙️ Editor Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="dark">🌙 Dark</option>
                    <option value="light">☀️ Light</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Font Size</label>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-500 mt-1">{fontSize}px</div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setShowSettings(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CodeEditorPage;
