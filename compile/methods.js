'use strict';

const mustache = require('mustache');
const { User } = require('../server/database');
const fs = require('fs');
const path = require('path');
const mailgun = require('../server/mailgun');
const { KEY, IV } = require('../server/settings.json');
const { encode } = require('../server/helper');

const templates = {
    EMAIL_TEMPLATE: fs.readFileSync(path.join(__dirname, '../templates/signup.html'), 'utf-8'),
}

async function sendMailAllScavenger(i) {
    const list = await User.find({ isScavengerHunt: true });

    for (const user of list) {

        const emailContent = mustache.render(templates.EMAIL_TEMPLATE, {
            url: `https://chunwan.cssawisc.org/user/${encode(user.email)}`,
            isScavengerHunt: user.isScavengerHunt
        });
    
        // const response = await mailgun.send({
        //     subject: 'CSSA牛年春晚抽奖链接',
        //     to: user.email,
        //     html: emailContent
        // });

        const response = { message: 'FOUND' };

        console.log(++i, user.email, response.message);
    }
}



module.exports = {
    sendMailAllScavenger
};
