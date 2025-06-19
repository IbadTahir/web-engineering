export interface LanguageTier {
  name: string;
  cost: 'low' | 'medium' | 'high';
  memoryLimit: string;
  cpuLimit: number;
  executionTimeout: number;
  concurrentLimit: number;
  baseImage: string;
  setupCommands: string[];
  fileExtension: string;
  executeCommand: (fileName: string) => string[];
  packageInstallCommand?: string[];
  commonPackages?: string[];
  active?: boolean;
  // New: packages that require build tools
  packagesRequiringBuildTools?: string[];
  buildToolsInstallCommand?: string[];
}

export interface ContainerConfig {
  language: string;
  isPersistent: boolean;
  roomId?: string;
  customPackages?: string[];
  memoryOverride?: string;
  timeoutOverride?: number;
}

export const languageTiers: Record<string, LanguageTier> = {
  // Low-cost, fast languages
  python: {
    name: 'Python',
    cost: 'low',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    executionTimeout: 10000,
    concurrentLimit: 20,
    baseImage: 'leviathan-python-optimized:latest',
    setupCommands: [
      // Minimal setup - packages are pre-installed in optimized image
      'pip list'  // Just verify environment
    ],
    fileExtension: '.py',
    executeCommand: (fileName) => ['python', fileName],
    packageInstallCommand: ['pip', 'install', '--no-cache-dir'],
    commonPackages: ['requests', 'json5', 'urllib3'],
    packagesRequiringBuildTools: ['numpy', 'pandas', 'scipy', 'matplotlib', 'pillow', 'psycopg2', 'lxml'],
    buildToolsInstallCommand: ['apt-get', 'update', '&&', 'apt-get', 'install', '-y', '--no-install-recommends', 'build-essential', '&&', 'rm', '-rf', '/var/lib/apt/lists/*'],
    active: true
  },

  javascript: {
    name: 'JavaScript (Node.js)',
    cost: 'low',
    memoryLimit: '256m',
    cpuLimit: 0.5,
    executionTimeout: 10000,
    concurrentLimit: 20,
    baseImage: 'leviathan-node-optimized:latest',
    setupCommands: [
      // Packages are pre-installed in optimized image
      'npm list -g --depth=0'  // Just verify environment
    ],
    fileExtension: '.js',
    executeCommand: (fileName) => ['node', fileName],
    packageInstallCommand: ['npm', 'install', '--no-save'],
    commonPackages: [], // Disabled to avoid slow installation during session creation
    active: true
  },

  go: {
    name: 'Go',
    cost: 'low',
    memoryLimit: '200m',
    cpuLimit: 0.5,
    executionTimeout: 8000,
    concurrentLimit: 25,
    baseImage: 'leviathan-go-optimized:latest',
    setupCommands: [
      // Packages are pre-installed in optimized image
      'go version'  // Just verify environment
    ],
    fileExtension: '.go',
    executeCommand: (fileName) => ['go', 'run', fileName],
    packageInstallCommand: ['go', 'get'],
    commonPackages: [], // Disabled to avoid slow installation during session creation
    active: true
  },

  // Medium-cost languages
  cpp: {
    name: 'C++',
    cost: 'medium',
    memoryLimit: '300m',
    cpuLimit: 1.0,
    executionTimeout: 20000,
    concurrentLimit: 12,
    baseImage: 'leviathan-cpp-optimized:latest',
    setupCommands: [
      // Build tools are pre-installed in optimized image
      'g++ --version'  // Just verify environment
    ],
    fileExtension: '.cpp',
    executeCommand: (fileName) => ['sh', '-c', `g++ -std=c++17 ${fileName} -o output && ./output`],
    packageInstallCommand: [],
    commonPackages: [],
    active: true
  },

  java: {
    name: 'Java',
    cost: 'medium',
    memoryLimit: '512m',
    cpuLimit: 1.0,
    executionTimeout: 15000,
    concurrentLimit: 10,
    baseImage: 'leviathan-java-optimized:latest',
    setupCommands: [
      // Maven is pre-installed in optimized image
      'java --version'  // Just verify environment
    ],
    fileExtension: '.java',
    executeCommand: (fileName) => ['sh', '-c', `javac ${fileName} && java ${fileName.replace('.java', '')}`],
    packageInstallCommand: [],
    commonPackages: [],
    active: true
  }
};

export const getLanguageConfig = (language: string): LanguageTier | undefined => {
  const config = languageTiers[language.toLowerCase()];
  return config?.active !== false ? config : undefined;
};

export const getSupportedLanguages = (): string[] => {
  return Object.keys(languageTiers).filter(key => 
    languageTiers[key].active !== false
  );
};

export const getActiveLanguages = (): Record<string, LanguageTier> => {
  return Object.fromEntries(
    Object.entries(languageTiers).filter(([_, config]) => config.active !== false)
  );
};

export const getLanguagesByTier = (cost: 'low' | 'medium' | 'high'): LanguageTier[] => {
  return Object.values(languageTiers).filter(lang => 
    lang.cost === cost && lang.active !== false
  );
};
