'use strict';

const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

// Connect to MongoDB
const dbURL = require('./settings.json').dbURL;
mongoose.connect(dbURL, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => console.log('MongoDB connected!'));

exports.User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true },
    emailConfirmed: { type: Boolean, default: false },
    eligible: { type: Boolean, default: false },
    ticketStart: { type: Number, default: 80000 },
    ticketEnd: { type: Number, default: 80000 },
    ticketNum: { type: Number, unique: true },
    isScavengerHunt: { type: Boolean, default: false },
    prizeWon: { type: Boolean, default: false },
    prizeConfirmed: { type: Boolean, default: false},
    prizeWonType: { type: Number },
    scavengerWon: { type: Number },
    scavengerConfirmed: { type: Boolean, default: false }
}));

exports.Result = mongoose.model('Result', new mongoose.Schema({
    '0': { type: Array, default: {} },
    '1': { type: Array, default: {} },
    '2': { type: Array, default: {} },
    '3': { type: Array, default: {} },
}));
