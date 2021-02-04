'use strict';

const Promise = require('bluebird');
const router = require('express').Router();
const request = require('request-promise');
const url = require('url');
const querystring = require('querystring');
const settings = require('./settings.json');
const adminlist = require('./adminlist.json');
const parse = addr => querystring.parse(url.parse(addr).query);
const fs = require('fs');
const path = require('path');

const { User } = require('./database');
const mustache = require('mustache');
const mailgun = require('./mailgun');
const { encode } = require('./helper');

// const template = fs.readFileSync(path.join(__dirname, '../compile/templates/delivered.html'), 'utf-8');

const TOKEN_LINK = 'https://accounts.google.com/o/oauth2/v2/auth?' + querystring.stringify({
    client_id: settings.client.id,
    redirect_uri: settings.redirectURI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/userinfo.email'
});

// Checks admin loggedIn status
router.post('/status', (req, res) => {
    const ssn = req.session;
    
    // Debug purposes
    if (settings.DEBUG) {
        ssn.loggedIn = true;
        ssn.hasPerm = true;
        ssn.adminName = 'Awesome Tester';
        ssn.adminEmail = 'tester@awesome.com';
        ssn.adminPerm = '.*';
    }
    

    if (!ssn.loggedIn) return res.json({ loggedIn: false });

    return res.json({
        loggedIn: true,
        hasPerm: ssn.hasPerm,
        email: ssn.adminEmail,
        name: ssn.adminName
    });
});

// Lucky draw commence
router.post('/luckydraw', async (req, res) => {
    const { io } = res.locals;
    const { type, limit } = req.body;
    let ticketWon;

    // Scavenger hunt lucky draw
    if (type === 0) {
        const userList = await User.find({
            emailConfirmed: true,
            isScavengerHunt: true
        });
        const ticketList = [];
        userList.forEach(({ ticketStart, ticketEnd }) => {
            const tickets = Array(ticketEnd - ticketStart + 1)
                .fill()
                .map((_, idx) => idx + ticketStart);
            
            ticketList.push(...tickets);
        });

        ticketWon = shuffle(shuffle(ticketList)).slice(0, limit);
    }

    // Other lucky draw 
    else {
        // List of all eligible users
        const userList = await User.find({
            emailConfirmed: true,
            eligible: true,
            prizeWon: false
        });

        // List of all their raffle ticket numbers
        const ticketList = shuffle(shuffle(userList.map(u => u.ticketNum)));
        ticketWon = ticketList.slice(0, limit);
    }

    // Finds user in database who wins
    let winningUsers;
    if (type === 0) { // Scavenger hunt, needs to deal with $lte and $gte limit
        const winningTicket = ticketWon[0];
        winningUsers = await User.find({
            ticketStart: { $lte: winningTicket },
            ticketEnd: { $gte: winningTicket }
        });
    }

    else { // Main raffle pool
        const orQuery = [];
        ticketWon.forEach(ticketNum => orQuery.push({ ticketNum }));
        if (orQuery.length === 0) winningUsers = [];
        else winningUsers = await User.find({ $or: orQuery });
    }

    // Delay 5 seconds, then store these users into database, and notify users
    Promise.delay(5000).then(async () => {
        const list = winningUsers.sort((a,b) => a.ticketNum-b.ticketNum);
        for (let user of list) {
            const prizeWonType = type === 0 ? user.prizeWonType : type;
            await user.updateOne({ prizeWon: true, prizeWonType, scavengerWon: ticketWon[0] });
            io.to(encode(user.email)).emit('prize_won', user.ticketNum);
        }
    });

    res.json({ ticketWon });
});

// Redraws a prize (resets expired users)
router.post('/redraw', async (req, res) => {
    const { io } = res.locals;
    const { type, originalTicket } = req.body;
    let ticketWon;

    // Resets win and confirm state of original ticket holder
    if (type === 0) {
        const user = await User.findOne({
            ticketStart: { $lte: originalTicket },
            ticketEnd: { $gte: originalTicket }
        });
        await user.updateOne({ scavengerWon: 0, scavengerConfirmed: false });
        io.to(encode(user.email)).emit('prize_expire');
    } else {
        const user = await User.findOne({ ticketNum: originalTicket });
        await user.updateOne({ prizeWon: false, prizeConfirmed: false });
        io.to(encode(user.email)).emit('prize_expire');
    }

    // Normal lucky draw for scavenger, limit 1
    if (type === 0) {
        const userList = await User.find({
            emailConfirmed: true,
            isScavengerHunt: true
        });
        const ticketList = [];
        userList.forEach(({ ticketStart, ticketEnd }) => {
            const tickets = Array(ticketEnd - ticketStart + 1)
                .fill()
                .map((_, idx) => idx + ticketStart);
            
            ticketList.push(...tickets);
        });

        ticketWon = shuffle(shuffle(ticketList)).slice(0, 1);
    }

    // Other lucky draw, limit 1
    else {
        // List of all eligible users
        const userList = await User.find({
            emailConfirmed: true,
            eligible: true,
            prizeWon: false
        });

        // List of all their raffle ticket numbers
        const ticketList = shuffle(shuffle(userList.map(u => u.ticketNum)));
        ticketWon = ticketList.slice(0, 1);
    }

    // Finds user in database who wins
    const winningTicket = ticketWon[0];
    let winningUser;
    if (type === 0) { // Scavenger hunt, needs to deal with $lte and $gte limit
        winningUser = await User.findOne({
            ticketStart: { $lte: winningTicket },
            ticketEnd: { $gte: winningTicket }
        });
    } else { // Normal draw
        winningUser = await User.findOne({ ticketNum: winningTicket });
    }


    // Delay 5 seconds, then store this user into database + notify
    Promise.delay(5000).then(async () => {
        const prizeWonType = type === 0 ? winningUser.prizeWonType : type;
        const prizeWon = type === 0 ? winningUser.prizeWon : true;
        const scavengerWon = type === 0 ? winningTicket : winningUser.scavengerWon;
        await winningUser.updateOne({ prizeWon, prizeWonType, scavengerWon });
        io.to(encode(winningUser.email)).emit('prize_won', winningUser.ticketNum);
    });

    res.json({ ticketWon: winningTicket });
});

// Checks which prizes have been drawn
router.get('/prizestatus', async (req, res) => {
    if (!req.session.hasPerm) return res.json({ error: 'NO_PERMISSION' });

    const prize0 = await User.find({ scavengerWon: { $gt: 80000 } });
    const prize1 = await User.find({ prizeWonType: 1, prizeWon: true });
    const prize2 = await User.find({ prizeWonType: 2, prizeWon: true });
    const prize3 = await User.find({ prizeWonType: 3, prizeWon: true });

    return res.json([ prize0, prize1, prize2, prize3 ]);
});

// router.post('/deliver', async (req, res) => {
//     const ssn = req.session;
//     if (!ssn.loggedIn || !ssn.hasPerm) return res.json({ error: 'NO_PERMISSION' });

//     const { wechat } = req.body;
//     const user = await User.findOne({ wechat, delivered: false });

//     if (!user) return res.json({ error: 'ALREADY_DELIVERED' });

//     const newUser = await user.updateOne({ delivered: true });

//     if (!newUser) return res.json({ error: 'UNKNOWN_USER' });

//     const { io } = res.locals;
//     io.emit('delivery', { wechat });

//     const { name, area } = user;
//     const isOnCampus = area === 0 || area === 1 || area === 4;
//     const isSheboygan = area === 2;
//     const isEagleHeights = area === 3;
//     // Send email
//     let emailContent = mustache.render(template, {
//         name,
//         isOnCampus,
//         isSheboygan,
//         isEagleHeights,
//     });

//     const response = await mailgun.send({
//         subject: isOnCampus ? '健康包：已送达' : '健康包：已自取',
//         to: user.email,
//         html: emailContent
//     });

//     return res.json({ success: 'SUCCESS', response });
// });

// // Gets all undelivered users in database
// router.get('/all', async (req, res) =>{
//     const ssn = req.session;
//     if (!ssn.hasPerm) return res.json({ error: 'Unauthorized '});

//     const users = await User.find({ delivered: false, addr1: { $regex: ssn.adminPerm } });
//     return res.json(users);
// });

// admin login endpoint
router.get('/login', (req, res) => {
    req.session.started = true;
    req.session.ip = req.headers['cf-connecting-ip']
        || req.headers['x-real-ip']
        || req.connection.remoteAddress;
    res.redirect(TOKEN_LINK);
});

// admin callback endpoint
router.get('/callback', (req, res) => {
    const ssn = req.session;

    if (!ssn.started) {
        res.redirect('/');
        return;
    }

    const urlArgs = parse(req.url);

    // On receiving authorization code
    if (urlArgs.code) {
        ssn.authCode = urlArgs.code;
    } else if (urlArgs.error) {
        log('Login error: %s (%s)', urlArgs.error, ssn.ip);
        ssn.destroy();
        res.redirect('/admin?error=' + urlArgs.error);
    }

    // Exchanges for information
    if (ssn.authCode && !ssn.accessToken) {

        // Gets access token
        getAccessToken(req).then(getUserEmail).then(() => {
            res.redirect('/admin');
        }).catch(err => {
            console.log(err);
            log(err.error);
            res.redirect('/admin?error=' + err.error);
        });
    }
});

// Admin logout endpoint
router.get('/logout', (req, res) => {
    const ssn = req.session;
    if (!ssn.loggedIn) res.redirect('/admin');
    else {
        log('Logged out from admin portal: %s <%s> (%s)', ssn.adminName, ssn.adminEmail, ssn.ip);
        if (ssn.destroy) ssn.destroy();
        res.redirect('/admin');
    }
});

// ==== Helper Methods ====

// Shuffle array
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function log (...args) {
    const date = '[ ' + new Date().toUTCString() + ' ] ';
    console.log(date + (args.shift() || ''), ...args);
}

/**
 * Gets user access token
 *
 * @param {Object} req The request object
 * @returns {Promise}
 */
function getAccessToken (req) {
    const ssn = req.session;
    return request.post({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        url: 'https://oauth2.googleapis.com/token',
        form: {
            client_id: settings.client.id,
            client_secret: settings.client.secret,
            grant_type: 'authorization_code',
            code: ssn.authCode,
            redirect_uri: settings.redirectURI,
        }
    }).then(data => {
        data = JSON.parse(data);
        ssn.accessToken = data.access_token;
        return Promise.resolve(req);
    }).catch(err => Promise.reject(err));
}

/**
 * Gets user email address
 *
 * @param {Object} req The request object
 * @returns {Promise}
 */
function getUserEmail (req) {
    const ssn = req.session;
    return request.get({
        headers: { 'Authorization': 'Bearer ' + ssn.accessToken },
        url: 'https://openidconnect.googleapis.com/v1/userinfo'
    }).then(data => {
        data = JSON.parse(data);
        const adminEmail = data.email;
        const adminArr = adminlist[adminEmail];
        let adminName, adminPerm;
        if (adminArr) {
            adminName = adminArr[0];
            adminPerm = adminArr[1];
        }

        ssn.loggedIn = true;
        ssn.adminEmail = adminEmail;
        ssn.hasPerm = data.hd === 'wisc.edu' && typeof adminName !== 'undefined';
        ssn.adminName = ssn.hasPerm ? adminName : 'unauthorized';
        ssn.adminPerm = adminPerm;
        log('Logged in to admin portal: %s <%s> (%s)', ssn.adminName, ssn.adminEmail, ssn.ip);
        return Promise.resolve();
    }).catch(err => Promise.reject(err));
}

module.exports = router;
