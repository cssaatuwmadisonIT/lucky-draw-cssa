'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const csv = require('csv-parser');
const { User } = require('../server/database');

const FILENAME = process.argv[2];

let baseTicket = 80001;

Promise.delay(2000).then(() => {
    const rs = fs.createReadStream(FILENAME)
    .pipe(csv())
    .on('data', async ({score, email}) => {
        rs.pause();
        await Promise.delay(50);
        rs.resume();

        email = email.toLowerCase()
        score = score * 20;

        const ticketStart = baseTicket;
        const ticketEnd = ticketStart + score - 1;
        baseTicket = ticketEnd + 1;

        const user = new User({
            email,
            eligible: true,
            ticketStart,
            ticketEnd,
            isScavengerHunt: true,
            ticketNum: -Date.now()
        });

        await user.save();

        console.log(`${email}\t${score}\t${ticketStart}~${ticketEnd}, ${-Date.now()}`);

    }).on('close', () => {
        console.log(`DONE`);
        rs.unpipe();
    });
});
