'use strict';

const Promise = require('bluebird');

const bodyParser = require('body-parser');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const express = require('express');
const session = require('express-session');

const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const settings = require('./settings.json');

const http = require('http');
const socketio = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// static paths for build
app.use(express.static(path.join(__dirname, '../client/build')));

// Creates session
app.use(cookieParser());
app.use(session({
    name: '_healthkit',
    secret: crypto.createHash('sha256').update('' + Date.now()).digest('hex'),
    resave: false,
    saveUninitialized: false,
    proxy: settings.proxy,
    cookie: {
        secure: settings.secure,
        httpOnly: true,
        maxAge: 24 * 3600 * 7 * 1000, // 7 days
    }
}));

// Joins socket to room
io.on('connection', socket => {
    socket.join(socket.handshake.query.room);
});

app.use((req, res, next) => {
    res.locals.io = io;
    next();
});

// User API route
app.use('/user', require('./user'));

// Admin authentication route (via wisc.edu)
app.use('/admin', require('./admin'));

// Home
app.get('*', (req, res) => { // jshint ignore:line
    res.status(200).sendFile(path.join(__dirname, '../client/build/index.html'));
});

server.listen(settings.PORT, () => console.log('Running at port %d', settings.PORT));

module.exports = app;
