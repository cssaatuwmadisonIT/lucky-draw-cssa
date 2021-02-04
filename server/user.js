'use strict';

const router = require('express').Router();
const { User } = require('./database');
const { encode, decode } = require('./helper');


// Signs up a user
router.post('/signup', async (req, res) => {
    const { email } = req.body;
    const eligible = /wisc\.edu$/.test(email);

    let user = await User.findOne({ email });
    if (!user) {
        user = new User({ email, eligible, ticketNum: -Date.now() });
        try {
            const data = await user.save();
        } catch (e) {
            return res.json({ error: true });
        }
    }

    // TODO: send email here

    const hash = encode(email);
    console.log(hash);
    return res.json({ submitted: true });
});

// Checks if a uer has a winning ticket (passive)
router.get('/:hash/check_winning_ticket', async (req, res) => {
    const { hash } = req.params;
    const user = await User.findOne({ email: decode(hash) });

    const { prizeWon, prizeConfirmed, scavengerWon, scavengerConfirmed } = user;
    
    return res.json({
        prizeWon,
        prizeConfirmed,
        scavengerWon,
        scavengerConfirmed,
        scavengerWonBoolean: user.isScavengerHunt && scavengerWon >= user.ticketStart && scavengerWon <= user.ticketEnd
    });
});

// User confirms winning ticket (active request)
router.post('/confirm_winning_ticket', async (req, res) => {
    const { io } = res.locals;
    const { hash, isScavenger } = req.body;
    const user = await User.findOne({ email: decode(hash) });

    // User didn't win scavenger
    if (isScavenger && user.scavengerWon <= 80000) {
        return res.json({
            confirmed: false, scavengerWon: 0
        });
    }

    // User didn't win
    else if (!isScavenger && !user.prizeWon) {
        return res.json({
            confirmed: false, prizeWon: false
        });
    }

    if (isScavenger) await user.updateOne({ scavengerConfirmed: true });
    else await user.updateOne({ prizeConfirmed: true });

    io.to('admin').emit('prize_confirm', isScavenger ? user.scavengerWon : user.ticketNum);

    res.json({ confirmed: true });
});

// Finds the current user
router.post('/:hash', async (req, res) => {
    try {
        const email = decode(req.params.hash);
        const user = await User.findOne({ email });
        if (!user) return res.json({ error: 'USER_NOT_FOUND' });

        // Update link viewed status
        if (!user.emailConfirmed) {
            const stagingUser = await user.updateOne({ emailConfirmed: true });
            if (!stagingUser) return res.json({ error: 'EMAIL_CONFIRMATION_FAILED '});
        }

        user.emailConfirmed = true;

        // User already has a ticket number
        if (user.ticketNum > 60000) return res.json({ user, hash: req.params.hash });

        // User does not have a ticket number
        const userList = await User.find({ ticketNum: { $gt: 60000 }});
        let baseNum = 60000;
        if (userList.length > 0) {
            baseNum = userList.sort((a,b) => b.ticketNum - a.ticketNum)[0].ticketNum;
        }
        const assignedNum = baseNum + Math.ceil(Math.random() * 5);
        await user.updateOne({ ticketNum: assignedNum });
        user.ticketNum = assignedNum;
        return res.json({ user, hash: req.params.hash });
    } catch (e) {
        res.status(400).json({ error: 'BAD_REQUEST' });
    }
});

module.exports = router;
