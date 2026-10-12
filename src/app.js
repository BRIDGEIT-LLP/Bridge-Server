const express = require('express');
// env config
const dotenv = require('dotenv');
const env = process.env.APP_ENV || 'local';
dotenv.config({
    path: env === 'uat' ? '.env.uat' : '.env'
});
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env_config = require('./configs/env_configs');
const requestResponseLogger = require('./middleware/requestResponseLogger');
const errorMiddleware = require('./middleware/errorLogger');
const HttpResponse = require('./utils/HttpResponse');
const db = require('./models');
const redis = require('./configs/redis');
const permissionService = require('./services/permissionService');
const adminConfigService = require('./services/adminConfigService');
const suspensionCacheService = require('./services/suspensionCacheService');
const adminSuspensionCacheService = require('./services/adminSuspensionCacheService');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const fileRoutes = require('./routes/fileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const dealRoomRoutes = require('./routes/dealRoomRoutes');
const chatRoutes = require('./routes/chatRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const scanErrorMiddleware = require('./middleware/scanError');
const { initSockets } = require('./sockets');
const userSessionRoutes = require('./routes/userSessionRoutes');
const faqRoutes = require('./routes/faqRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();

// credentials: true + an explicit origin (never '*') is required for the browser to
// send/accept the httpOnly auth cookies cross-origin (dev frontend :3000 vs backend
// :3001/4000). A single fixed origin can't fit everyone's local dev port though, so
// this validates the request's Origin against the allow-list in FRONTEND_ORIGINS and
// reflects back only that one matched value — still never a wildcard, so credentials
// stays valid. Shared identically by Socket.io's CORS config below.
const corsOriginCheck = (origin, callback) => {
    // No Origin header (same-origin request, curl, server-to-server) — allow.
    if (!origin) return callback(null, true);
    // Trailing-slash-tolerant match — 'http://localhost:3000/' vs 'http://localhost:3000'
    // is an easy, otherwise-silent mismatch against a strict equality check.
    const normalized = origin.replace(/\/$/, '');
    if (env_config.FRONTEND_ORIGINS.some((o) => o.replace(/\/$/, '') === normalized)) {
        return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
};
app.use(cors({ origin: corsOriginCheck, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Application request response logger
app.use(requestResponseLogger);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/file', fileRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/matching', matchingRoutes);
app.use('/api/v1/connections', connectionRoutes);
app.use('/api/v1/deal-rooms', dealRoomRoutes);
app.use('/api/v1/deal-rooms/:dealRoomId/messages', chatRoutes);
app.use('/api/v1/sessions', userSessionRoutes);
app.use('/api/v1/meetings', meetingRoutes);
app.use('/api/v1/faqs', faqRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

app.get('/', (req, res) => {
    return HttpResponse.success(res, {
        message: 'Hello World from Server!'
    });
});

// middleware
app.use(errorMiddleware);
app.use(scanErrorMiddleware);

const SERVER_PORT = env_config.SERVER_PORT || 3001;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOriginCheck, credentials: true } });
initSockets(io);

redis.on('connect', () => {
    permissionService.loadAllRolePermissionsIntoCache()
        .catch(err => console.error('Failed to load role permissions into Redis:', err));
});

server.listen(SERVER_PORT, () => {
    db.sequelize.authenticate()
        .then(() => {
            console.info('Database connected successfully.');
            adminConfigService.cacheOtpConfig()
                .catch(err => console.error('Failed to cache OTP config into Redis:', err));
            adminConfigService.cacheTrialConfig()
                .catch(err => console.error('Failed to cache trial config into Redis:', err));
            suspensionCacheService.loadSuspendedUsersIntoCache()
                .catch(err => console.error('Failed to load suspended users into Redis:', err));
            adminSuspensionCacheService.loadSuspendedAdminsIntoCache()
                .catch(err => console.error('Failed to load suspended admins into Redis:', err));
        })
        .catch(err => console.error('Unable to connect to the database:', err));
    console.info(`Server is running on port http://localhost:${SERVER_PORT}`);
});

module.exports = app;