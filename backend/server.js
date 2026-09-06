const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const dotenv = require('dotenv');

// 1. Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const configurePassport = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { isGeminiConfigured } = require('./services/geminiService');

const app = express();
const PORT = process.env.PORT || 8000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 2. Connect to MongoDB Atlas
connectDB();

// 3. Configure Passport Google OAuth
configurePassport();

// 4. CORS configuration
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 5. Middleware for parsing JSON & cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// 6. Register Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// 7. Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 8. Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
});

// 9. Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (isGeminiConfigured()) {
    console.log(`Gemini enhancement active (Model: ${process.env.GEMINI_MODEL || 'gemini-3.8-flash'})`);
  } else {
    console.log('Gemini enhancement disabled: GEMINI_API_KEY is not configured.');
  }
});

module.exports = app;
