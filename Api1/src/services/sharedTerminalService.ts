import { Server as SocketIOServer, Namespace } from 'socket.io';
import { Server as HTTPServer } from 'http';
import Dockerode from 'dockerode';
import { Container } from 'dockerode';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { dbHelpers } from '../database';

interface TerminalSession {
  id: string;
  containerId: string;
  roomId: string;
  userId: string;
  container: Container;
  execInstance?: any;
  isActive: boolean;
  startTime: Date;
}

interface RoomTerminal {
  roomId: string;
  containerId: string;
  container: Container;
  activeSessions: Map<string, TerminalSession>;
  createdAt: Date;
  lastActivity: Date;
}

class SharedTerminalService {
  private io: SocketIOServer | Namespace;
  private docker: Dockerode;
  private roomTerminals: Map<string, RoomTerminal> = new Map();
  private userSessions: Map<string, TerminalSession> = new Map();
  private readonly SHARED_IMAGE = 'code-editor-shared:latest';
  private readonly MAX_OUTPUT_SIZE = 50000; // 50KB max output per message

  constructor(server: HTTPServer, io?: SocketIOServer) {
    if (io) {
      // Use shared Socket.IO instance with namespace
      this.io = io.of('/terminal');
    } else {
      // Create new Socket.IO instance (backward compatibility)
      this.io = new SocketIOServer(server, {
        cors: {
          origin: "*", // Configure properly for production
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
      });
    }

    // Platform-specific Docker socket configuration
    const dockerConfig = process.platform === 'win32' 
      ? { socketPath: '//./pipe/docker_engine' }
      : { socketPath: '/var/run/docker.sock' };
      
    this.docker = new Dockerode(dockerConfig);

    this.setupSocketHandlers();
    this.startCleanupInterval();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join room terminal
      socket.on('join-room-terminal', async (data) => {
        try {
          const { roomId, userId } = data;
          
          if (!roomId || !userId) {
            socket.emit('terminal-error', { message: 'Room ID and User ID are required' });
            return;
          }

          // Verify user has access to room
          const hasAccess = await this.verifyRoomAccess(roomId, userId);
          if (!hasAccess) {
            socket.emit('terminal-error', { message: 'Access denied to room' });
            return;
          }

          // Get or create room terminal
          let roomTerminal = await this.getOrCreateRoomTerminal(roomId);
          
          // Create user terminal session
          const session = await this.createTerminalSession(roomTerminal, userId, socket.id);
          
          // Join socket room
          socket.join(`room-${roomId}`);
          socket.join(`terminal-${session.id}`);
          
          // Store session reference
          this.userSessions.set(socket.id, session);
          
          socket.emit('terminal-ready', {
            sessionId: session.id,
            roomId: roomId,
            message: 'Terminal connected. You can now run commands.'
          });

          // Send welcome message
          socket.emit('terminal-output', {
            data: `Welcome to shared coding environment!\nRoom: ${roomId}\nUser: ${userId}\n$ `,
            sessionId: session.id
          });

        } catch (error) {
          console.error('Error joining room terminal:', error);
          socket.emit('terminal-error', { 
            message: 'Failed to join room terminal',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Send terminal input
      socket.on('terminal-input', async (data) => {
        try {
          const { input, sessionId } = data;
          const session = this.userSessions.get(socket.id);

          if (!session || !session.isActive) {
            socket.emit('terminal-error', { message: 'No active terminal session' });
            return;
          }

          if (!session.execInstance) {
            // Create new exec instance
            session.execInstance = await session.container.exec({
              Cmd: ['/bin/bash'],
              AttachStdin: true,
              AttachStdout: true,
              AttachStderr: true,
              Tty: true,
              WorkingDir: '/workspace'
            });

            const stream = await session.execInstance.start({
              hijack: true,
              stdin: true,
              Tty: true
            });

            // Handle output
            stream.on('data', (chunk: Buffer) => {
              const output = this.sanitizeOutput(chunk.toString());
              if (output.length > 0) {
                // Broadcast to all users in the room
                this.io.to(`room-${session.roomId}`).emit('terminal-output', {
                  data: output,
                  sessionId: session.id,
                  userId: session.userId
                });
              }
            });

            stream.on('error', (error: Error) => {
              console.error('Terminal stream error:', error);
              socket.emit('terminal-error', { 
                message: 'Terminal connection error',
                sessionId: session.id 
              });
            });

            // Store stream reference
            session.execInstance.stream = stream;
          }

          // Send input to terminal
          if (session.execInstance.stream && session.execInstance.stream.writable) {
            session.execInstance.stream.write(input);
            
            // Update last activity
            const roomTerminal = this.roomTerminals.get(session.roomId);
            if (roomTerminal) {
              roomTerminal.lastActivity = new Date();
            }
          }

        } catch (error) {
          console.error('Error handling terminal input:', error);
          socket.emit('terminal-error', { 
            message: 'Failed to process terminal input',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket.id);
      });

      // Get room file listing
      socket.on('list-files', async (data) => {
        try {
          const { path = '/workspace' } = data;
          const session = this.userSessions.get(socket.id);

          if (!session) {
            socket.emit('terminal-error', { message: 'No active session' });
            return;
          }

          const exec = await session.container.exec({
            Cmd: ['ls', '-la', path],
            AttachStdout: true,
            AttachStderr: true
          });

          const stream = await exec.start({ Detach: false });
          let output = '';

          stream.on('data', (chunk: Buffer) => {
            output += chunk.toString();
          });

          stream.on('end', () => {
            socket.emit('file-list', {
              path: path,
              files: this.parseFileList(output)
            });
          });

        } catch (error) {
          console.error('Error listing files:', error);
          socket.emit('terminal-error', { message: 'Failed to list files' });
        }
      });
    });
  }

  private async verifyRoomAccess(roomId: string, userId: string): Promise<boolean> {
    try {
      // Check if user has access to the room
      const roomUsers = await dbHelpers.getRoomUsers(roomId);
      return roomUsers.some(user => user.user_id === userId);
    } catch (error) {
      console.error('Error verifying room access:', error);
      return false;
    }
  }

  private async getOrCreateRoomTerminal(roomId: string): Promise<RoomTerminal> {
    let roomTerminal = this.roomTerminals.get(roomId);
    
    if (!roomTerminal) {
      // Create new shared container for the room
      const container = await this.createSharedContainer(roomId);
      
      if (!container.id) {
        throw new Error('Failed to create container: container ID is undefined');
      }
      
      roomTerminal = {
        roomId,
        containerId: container.id,
        container,
        activeSessions: new Map(),
        createdAt: new Date(),
        lastActivity: new Date()
      };
      
      this.roomTerminals.set(roomId, roomTerminal);
      
      // Update database with container ID
      await dbHelpers.updateRoomContainer(roomId, container.id);
    }
    
    return roomTerminal;
  }

  private async createSharedContainer(roomId: string): Promise<Container> {
    console.log(`Creating shared container for room: ${roomId}`);

    // Create container with shared image
    const container = await this.docker.createContainer({
      Image: this.SHARED_IMAGE,
      name: `shared-room-${roomId}-${Date.now()}`,
      Cmd: ['/bin/bash'],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace',
      HostConfig: {
        Memory: 1024 * 1024 * 1024, // 1GB memory for shared containers
        MemorySwap: 2 * 1024 * 1024 * 1024, // 2GB swap
        CpuCount: 2, // 2 CPU cores
        SecurityOpt: ['no-new-privileges'],
        NetworkMode: 'none', // No external network access
        AutoRemove: false // Keep container for persistence
      },
      Env: [
        `ROOM_ID=${roomId}`,
        'TERM=xterm-256color'
      ]
    });

    // Start the container
    await container.start();
    
    console.log(`Shared container created and started: ${container.id}`);
    return container;
  }

  private async createTerminalSession(
    roomTerminal: RoomTerminal, 
    userId: string, 
    socketId: string
  ): Promise<TerminalSession> {
    const sessionId = uuidv4();
    
    const session: TerminalSession = {
      id: sessionId,
      containerId: roomTerminal.containerId,
      roomId: roomTerminal.roomId,
      userId,
      container: roomTerminal.container,
      isActive: true,
      startTime: new Date()
    };

    roomTerminal.activeSessions.set(socketId, session);
    return session;
  }

  private handleDisconnect(socketId: string): void {
    const session = this.userSessions.get(socketId);
    
    if (session) {
      // Clean up exec instance
      if (session.execInstance && session.execInstance.stream) {
        try {
          session.execInstance.stream.end();
        } catch (error) {
          console.error('Error closing terminal stream:', error);
        }
      }

      // Remove from room terminal
      const roomTerminal = this.roomTerminals.get(session.roomId);
      if (roomTerminal) {
        roomTerminal.activeSessions.delete(socketId);
      }

      // Remove user session
      this.userSessions.delete(socketId);
      
      console.log(`Terminal session disconnected: ${session.id}`);
    }
  }

  private sanitizeOutput(output: string): string {
    // Remove dangerous escape sequences and control characters
    let sanitized = output
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars except \n, \t, \r

    // Limit output size
    if (sanitized.length > this.MAX_OUTPUT_SIZE) {
      sanitized = sanitized.substring(0, this.MAX_OUTPUT_SIZE) + '\n[Output truncated...]\n';
    }

    return sanitized;
  }

  private parseFileList(output: string): any[] {
    const lines = output.split('\n').filter(line => line.trim());
    const files = [];

    for (const line of lines) {
      if (line.startsWith('total')) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        files.push({
          permissions: parts[0],
          size: parts[4],
          date: `${parts[5]} ${parts[6]} ${parts[7]}`,
          name: parts.slice(8).join(' '),
          isDirectory: parts[0].startsWith('d')
        });
      }
    }

    return files;
  }

  private startCleanupInterval(): void {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);

    // Clean up unused room terminals every 30 minutes
    setInterval(() => {
      this.cleanupUnusedRoomTerminals();
    }, 30 * 60 * 1000);
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

    for (const [socketId, session] of this.userSessions.entries()) {
      const inactiveTime = now.getTime() - session.startTime.getTime();
      
      if (inactiveTime > maxInactiveTime) {
        this.handleDisconnect(socketId);
      }
    }
  }

  private async cleanupUnusedRoomTerminals(): Promise<void> {
    const now = new Date();
    const maxUnusedTime = 60 * 60 * 1000; // 1 hour

    for (const [roomId, roomTerminal] of this.roomTerminals.entries()) {
      const unusedTime = now.getTime() - roomTerminal.lastActivity.getTime();
      
      if (unusedTime > maxUnusedTime && roomTerminal.activeSessions.size === 0) {
        try {
          // Stop and remove container
          await roomTerminal.container.stop({ t: 10 });
          await roomTerminal.container.remove({ force: true });
          
          // Remove from tracking
          this.roomTerminals.delete(roomId);
          
          console.log(`Cleaned up unused room terminal: ${roomId}`);
        } catch (error) {
          console.error(`Error cleaning up room terminal ${roomId}:`, error);
        }
      }
    }
  }

  // Public methods for external access
  public getActiveRoomTerminals(): string[] {
    return Array.from(this.roomTerminals.keys());
  }

  public getRoomTerminalInfo(roomId: string): any {
    const roomTerminal = this.roomTerminals.get(roomId);
    if (!roomTerminal) return null;

    return {
      roomId: roomTerminal.roomId,
      containerId: roomTerminal.containerId,
      activeSessions: roomTerminal.activeSessions.size,
      createdAt: roomTerminal.createdAt,
      lastActivity: roomTerminal.lastActivity
    };
  }

  public async executeCommand(roomId: string, command: string): Promise<string> {
    const roomTerminal = this.roomTerminals.get(roomId);
    if (!roomTerminal) {
      throw new Error('Room terminal not found');
    }

    const exec = await roomTerminal.container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ Detach: false });
    let output = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      stream.on('end', () => {
        resolve(this.sanitizeOutput(output));
      });

      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}

export default SharedTerminalService;
