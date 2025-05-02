// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path')

const app = express();

// Serve ALL frontend files statically
app.use(express.static(path.join(__dirname, 'frontend')));

// Middleware
app.use(express.json());
require('dotenv').config();
// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to local MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        console.log('Trying to reconnect in 5 seconds...');
        setTimeout(() => mongoose.connect(process.env.MONGODB_URI), 5000);
    });

// Enable better error handling
mongoose.connection.on('error', err => {
    console.error('MongoDB connection lost:', err);
});
// Models
const User = require('./backend/models/User');
const Shader = require('./backend/models/Shader');

// Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/shaders', require('./backend/routes/shaders'));

// Fallback to index.html for SPA routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));