import express, { Router, RequestHandler } from 'express';
import { executeCode } from './controllers/codeExecutionController';
import {
  getSupportedLanguagesController,
  getLanguagesByTierController,
  createDynamicContainer,
  executeCodeInContainer,
  getContainerStatus,
  destroyContainer,
  listContainers,
  executeCodeTransient
} from './controllers/dynamicCodeController';
import {
  getActiveSessions,
  getSessionInfo,
  terminateSession,
  createSessionEndpoint,
  getWebSocketInfo
} from './controllers/websocketController';
import sessionController from './controllers/sessionController';

const router: Router = express.Router();

// === NEW SESSION-BASED API ===
// Session management endpoints (new session-based API)
router.post('/sessions/init', sessionController.initializeSession as RequestHandler);
router.post('/sessions/join/:roomId', sessionController.joinRoom as RequestHandler);  
router.post('/sessions/:sessionId/execute', sessionController.executeCode as RequestHandler);
router.get('/sessions/:sessionId', sessionController.getSession as RequestHandler);
router.get('/sessions/user/active', sessionController.getUserSessions as RequestHandler);
router.delete('/sessions/:sessionId', sessionController.terminateSession as RequestHandler);

// Admin endpoints
router.post('/sessions/admin/cleanup', sessionController.triggerCleanup as RequestHandler);

// Room management
router.get('/rooms', sessionController.getRooms as RequestHandler);
router.get('/rooms/:roomId', sessionController.getRoomInfo as RequestHandler);
router.get('/rooms/:roomId/users', sessionController.getRoomUsers as RequestHandler);

// Terminal access endpoints
router.get('/sessions/:sessionId/terminal', (req, res) => {
    const { sessionId } = req.params;
    res.json({
        success: true,
        data: {
            sessionId,
            terminalEndpoint: 'ws://localhost:3000/terminal',
            protocol: 'Socket.IO',
            namespace: '/terminal',
            description: 'Connect to shared terminal via Socket.IO'
        }
    });
});

// Shared terminal endpoints (WebSocket connections handled by SharedTerminalService)
router.get('/rooms/:roomId/terminal/info', (req, res) => {
    const { roomId } = req.params;
    res.json({
        success: true,
        data: {
            roomId,
            terminalEndpoint: `/terminal/${roomId}`,
            protocol: 'ws',
            description: 'Connect to shared terminal via WebSocket'
        }
    });
});

// Language discovery
router.get('/languages/available', sessionController.getAvailableLanguages as RequestHandler);

// === LEGACY ENDPOINTS (backward compatibility) ===
// Legacy endpoint (keep for backward compatibility)
router.post('/execute', executeCode as RequestHandler);

// Language information endpoints
router.get('/languages', getSupportedLanguagesController as RequestHandler);
router.get('/languages/tier/:tier', getLanguagesByTierController as RequestHandler);

// Container management endpoints
router.post('/containers', createDynamicContainer as RequestHandler);
router.get('/containers', listContainers as RequestHandler);
router.get('/containers/:containerId/status', getContainerStatus as RequestHandler);
router.delete('/containers/:containerId', destroyContainer as RequestHandler);

// Code execution endpoints
router.post('/containers/execute', executeCodeInContainer as RequestHandler);
router.post('/execute/transient', executeCodeTransient as RequestHandler);

// WebSocket interactive execution endpoints
router.get('/websocket/info', getWebSocketInfo as RequestHandler);
router.post('/websocket/session', createSessionEndpoint as RequestHandler);
router.get('/websocket/sessions', getActiveSessions as RequestHandler);
router.get('/websocket/sessions/:sessionId', getSessionInfo as RequestHandler);
router.delete('/websocket/sessions/:sessionId', terminateSession as RequestHandler);

export default router;
