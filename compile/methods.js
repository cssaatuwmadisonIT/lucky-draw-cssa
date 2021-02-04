'use strict';

const mustache = require('mustache');
const { User } = require('../server/database');
const fs = require('fs');
const path = require('path');
const mailgun = require('../server/mailgun');
const { KEY, IV } = require('../server/settings.json');

const templates = {
    confirmAddr: fs.readFileSync(path.resolve('templates/confirm_address.html'), 'utf-8'),
    userStd: fs.readFileSync(path.resolve('templates/user_std.html'), 'utf-8'),
    userSpecial: fs.readFileSync(path.resolve('templates/user_special.html'), 'utf-8'),
    userSheboyganEH: fs.readFileSync(path.resolve('templates/user_sheboygan_eh_update.html'), 'utf-8'),
    userSparse: fs.readFileSync(path.resolve('templates/user_sparse_new.html'), 'utf-8'),
    userFrances: fs.readFileSync(path.resolve('templates/user_frances.html'), 'utf-8'),
    delivered: fs.readFileSync(path.resolve('templates/delivered.html'), 'utf-8'),
    sunday: fs.readFileSync(path.resolve('templates/final_list.html'), 'utf-8'),
}

async function dataForArea0() {
    const result = {};
    const commonApt = '(777 UNIV)|(1402 RE)|(1001 UNIV)|(1022 W JOH)|(1022 JOH)|' +
        '(437 N FR)|(437 FR)|(305 N FR)|(305 FR)|(530 W JOHN)|(530 JOHN)|(432 W GOR)|' + 
        '(432 GOR)|(1423 MON)|(110 N BED)|(110 BED)|(502 N FRA)|(502 FRA)|(439 E CA)|' + 
        '(633 LAN)';

    // not(commonApt) is(area=0,4)
    const dayton = '(\\d+ DAY)|(\\d+ W DAY)';
    const johnson = '(\\d+ JOH)|(\\d+ W JOH)';
    const university = '(\\d+ UNIV)';
    const langdon = '(\\d+ LAN)';
    const state = '(\\d+ STATE)';
    const list = await User.find({ $and: [
        {addr1: {$not: {$regex: commonApt}}}, 
        { $or: [
            {area: 0 }, 
            {area : 4},
        ]}
        // {addr1: {$not: {$regex: university}}},
        // {addr1: {$not: {$regex: langdon}}},
        // {addr1: {$not: {$regex: state}}},
    ]});

    for (const user of list) {
        const { addr1 } = user;
        if (result[addr1]) ++result[addr1];
        else result[addr1] = 1;
    }

    console.log(result);
    let sum = 0;
    for (const item in result) {
        sum += result[item];
    }
    console.log(sum);
}

function findAddressWithNoRoomNum () {
    // Query criteria:
    // Person is near Madison, has wisc.edu account, but did not put in a room or apartment number
    // This excludes anyone in Eagle Heights and Sheboygan
    // Excludes those who put an apartment letter (APT X)
    // Query logic:
    /*
    (Person lives close to Madison)
        AND
    (Person does not live in Sheboygan)
        AND
    (Person does not live in Eagle Heights)
        AND
    (Person has a wisc.edu address)
        AND
    (addr2 does not have letter apartment designator i.e. APT X)
        AND (
            (addr2 field is empty)
                OR
            (addr2 field has no number)
                OR
            (addr2 field starts with no numbers, then ends with ZIPCODE)
        )
    */
    const queryObj = {
        $and: [
            { area: { $ne: 8 } },
            // { area: { $ne: 3 } },
            // { area: { $ne: 2 } },
            { info: { $not: { $regex: '@' } } },
            { addr2: { $not: { $regex: '((APT|APARTMENT|ROOM|RM|SUITE) [A-Z])|(^[A-Z]$)|(^[A-Z] .+$)' } } },
            { $or: [
                { addr2: '' },
                { addr2: { $not: { $regex: '\\d+' } } },
                { addr2: { $regex: '^[A-Z\\s]+\\d{5}(\\-\\d{4})?$' } } 
            ] }
        ]
    };

    return User.find(queryObj);
}


function findHarry () {
    return User.findOne({ wechat: 'harry1999' });
}

async function sendMail (i) {
    // const users = await findAddressWithNoRoomNum();
    const user = await User.findOne({ wechat: 'harry1999' });

    // for (let user of users) {
    // const user = users[i];
    const emailContent = mustache.render(templates.confirmAddr, {
        name: user.name,
        address: user.address,
        addr1: user.addr1,
        addr2: user.addr2 || '----'
    });

    const response = await mailgun.send({
        subject: '健康包信息登记：请确认房间号',
        to: user.email,
        html: emailContent
    });

    
}

async function sendMailStd(i) {
    const list = await User.find({ area: { $lt: 8 }});

    for (const user of list) {

        const emailContent = mustache.render(templates.userStd, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3
        });
    
        const response = await mailgun.send({
            subject: '健康包信息最终确认',
            to: user.email,
            html: emailContent
        });

        // const response = { message: 'FOUND' };

        console.log(++i, user.email, response.message);
    }
}

async function updateUserLate(i) {
    const list = JSON.parse(fs.readFileSync(path.resolve('addUsers.json'), 'utf-8'));

    for (const wechat of list) {
        const user = await User.findOneAndUpdate({ wechat: wechat.toLowerCase().trim() }, { need: true });
        if (!user) console.log('ERROR', wechat);
    }
}

async function sendMailNotMadison(i) {
    const list = await User.find({ area: 8 });

    for (const user of list) {
        const emailContent = mustache.render(templates.userSpecial, {
            name: user.name
        });
    
        const response = await mailgun.send({
            subject: '健康包信息最终确认',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

const retryList = [
    "895865089@wisc.edu",
    "csymichelle24@wisc.edu",
    "jackie7758@wisc.edu",
    "jiang325@wisc.edu",
    "lchen522@wisc.edu",
    "lliu16@wisc.edu",
    "xhan30@wisc.edu",
    "yanz28@wisc.edu",
    "ylu339@wisc.edu"
];

const newList = [
    "han8@uwm.edu"
];

async function print () {
    for (let email of retryList) {
        const user = await User.findOne({ email });

        const { name, wechat, phone, address} = user;
        console.log('%s, %s, %d, %s, %s', name, wechat, phone, email, address);
    }
}

async function sendMailRetry(i) {
    const result = {};
    const commonApt = '(777 UNIV)|(1402 RE)|(1001 UNIV)|(1022 W JOH)|(1022 JOH)|' +
        '(437 N FR)|(437 FR)|(305 N FR)|(305 FR)|(530 W JOHN)|(530 JOHN)|(432 W GOR)|' + 
        '(432 GOR)|(1423 MON)|(110 N BED)|(110 BED)|(502 N FRA)|(502 FRA)|(439 E CA)|' + 
        '(633 LAN)';

    // not(commonApt) is(area=0,4)
    const dayton = '(\\d+ DAY)|(\\d+ W DAY)';
    const johnson = '(\\d+ JOH)|(\\d+ W JOH)';
    const university = '(\\d+ UNIV)';
    const langdon = '(\\d+ LAN)';
    const state = '(\\d+ STATE)';


    const COMMON_APT_AREA0_1_4_NEW = {$and: [
        { $or: [ { addr1: { $regex: commonApt }}, { area:1 } ]}, 
        { $or: [ { area: 0 }, { area: 4 }, { area: 1 } ]},
        { linkViewed: false },
        { need: true }
    ]};

    const newList = await User.find(COMMON_APT_AREA0_1_4_NEW);

    for (const user of newList) {
        console.log('%d %s area: %d', ++i, user.addr1, user.area);
    }
    

    // for (const email of newList) {
    //     const user = await User.findOne({ email });

    //     if (!user) continue;

    //     let emailContent;
    //     if (user.area === 8) emailContent = mustache.render(templates.userSpecial, {
    //         name: user.name
    //     });

    //     else emailContent = mustache.render(templates.userStd, {
    //         name: user.name,
    //         url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
    //         isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
    //         isSheboygan: user.area === 2,
    //         isEagleHeights: user.area === 3
    //     });
    
    //     const response = await mailgun.send({
    //         subject: '健康包信息最终确认',
    //         to: user.email,
    //         html: emailContent
    //     });
    //     // const response = { message: 'FOUND' };
    
    //     console.log(++i, user.email, response.message);
    // }
}

/**
 * 明早第0封，发给未读第一封邮件的住在common apt和宿舍的人
 * @param {*} i 
 */
async function sendMailUnread(i) {
    const commonApt = '(777 UNIV)|(1402 RE)|(1001 UNIV)|(1022 W JOH)|(1022 JOH)|' +
        '(437 N FR)|(437 FR)|(305 N FR)|(305 FR)|(530 W JOHN)|(530 JOHN)|(432 W GOR)|' + 
        '(432 GOR)|(1423 MON)|(110 N BED)|(110 BED)|(502 N FRA)|(502 FRA)|(439 E CA)|' + 
        '(633 LAN)';
    
    const newList = await User.find({
        $or: [{area: { $eq: 1 }}, { area: { $regex: commonApt}}],
        linkViewed: false,
        need: false,
        $and: [
            { area: { $ne: 8 } },
            { area: { $ne: 3 } },
            { area: { $ne: 2 } },
        ]
    });

    for (const user of newList) {

        let emailContent;
        if (user.area === 8) emailContent = mustache.render(templates.userSpecial, {
            name: user.name
        });

        else emailContent = mustache.render(templates.userStd, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3
        });
    
        const response = await mailgun.send({
            subject: '健康包信息再次最终确认',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}


/**
 * 明早第一封，只发给新人；必须住在common apts或学校宿舍
 * @param {*} i 
 */
async function sendMailNewUsersInDormsOrCommonApt(i) {
    const commonApt = '(777 UNIV)|(1402 RE)|(1001 UNIV)|(1022 W JOH)|(1022 JOH)|' +
        '(437 N FR)|(437 FR)|(305 N FR)|(305 FR)|(530 W JOHN)|(530 JOHN)|(432 W GOR)|' + 
        '(432 GOR)|(1423 MON)|(110 N BED)|(110 BED)|(502 N FRA)|(502 FRA)|(439 E CA)|' + 
        '(633 LAN)';


    const COMMON_APT_AREA0_1_4_NEW = {$and: [
        { $or: [ { addr1: { $regex: commonApt }}, { area:1 } ]}, 
        { $or: [ { area: 0 }, { area: 4 }, { area: 1 } ]},
        { linkViewed: false },
        { need: true }
    ]};

    const newList = await User.find(COMMON_APT_AREA0_1_4_NEW);

    for (const user of newList) {

        let emailContent;
        if (user.area === 8) emailContent = mustache.render(templates.userSpecial, {
            name: user.name
        });

        else emailContent = mustache.render(templates.userStd, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3
        });
    
        const response = await mailgun.send({
            subject: '健康包信息最终确认',
            to: user.email,
            html: emailContent
        });
    
        console.log(++i, user.email, response.message);
    }
}


/**
 * 明早第二封，发给新旧Eagle Heights的人；内容：请有点公德心 (新人额外内容：profile链接)
 * @param {*} i 
 */
async function sendMailAllEagleHeights(i) {


    const ALL_EAGLE_HTS = { area: 3 };

    const newList = await User.find(ALL_EAGLE_HTS);

    for (const user of newList) {

        let emailContent;
        if (user.area === 8) emailContent = mustache.render(templates.userSpecial, {
            name: user.name
        });

        else emailContent = mustache.render(templates.userSheboyganEH, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3,
            isNewUser: !user.linkViewed && user.need
        });
    
        const response = await mailgun.send({
            subject: '健康包领取提醒 - Eagle Heights',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

/**
 * 明早第三封，发给新旧Sheboygan的人；内容：请有点公德心 (新人额外内容：profile链接)
 * @param {*} i 
 */
async function sendMailAllSheboygan(i) {


    const ALL_SHEBOYGAN = { area: 2 };

    const newList = await User.find(ALL_SHEBOYGAN);

    for (const user of newList) {

        let emailContent;
        if (user.area === 8) emailContent = mustache.render(templates.userSpecial, {
            name: user.name
        });

        else emailContent = mustache.render(templates.userSheboyganEH, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3,
            isNewUser: !user.linkViewed && user.need
        });
    
        const response = await mailgun.send({
            subject: '健康包领取提醒 - Sheboygan',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

async function sendTestMail(i) {
    const newList = [
        { area: 0, wechat: 'blah', name: '住在校园附近，但是不能派送的老人', addr1: 'BLAH' },
        { area: 0, linkViewed: false, need: true, wechat: 'blah', name: '住在校园附近，但是不能派送的新人', addr1: 'BLAH' },
        { area: 4, wechat: 'blah', name: '住在其它麦迪逊附近的老人', addr1: 'BLAH' },
        { area: 4, linkViewed: false, need: true, wechat: 'blah', name: '住在其它麦迪逊附近的新人', addr1: 'BLAH' },
        { area: 8, wechat: 'blah', name: '不住在麦迪逊的老人', addr1: 'BLAH' },
        { area: 8, linkViewed: false, need: true, wechat: 'blah', name: '不住在麦迪逊的新人', addr1: 'BLAH' },
    ];
    for (const user of newList) {

        let emailContent = mustache.render(templates.userSparse, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3,
            isNewUser: !user.linkViewed && user.need
        });
    
        const response = await mailgun.send({
            subject: user.name,
            to: 'hxue36@wisc.edu, sguo92@wisc.edu',
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}


/**
 * 明早第四封，发给没有住在宿舍、没有住在common apt的除了eagle heights和sheboygan地区的所有人
 * @param {*} i 
 */
async function sendMailNewUsersInOtherApartmentsOnOrOffCampus(i) {
    const commonApt = '(777 UNIV)|(1402 RE)|(1001 UNIV)|(1022 W JOH)|(1022 JOH)|' +
        '(437 N FR)|(437 FR)|(305 N FR)|(305 FR)|(530 W JOHN)|(530 JOHN)|(432 W GOR)|' + 
        '(432 GOR)|(1423 MON)|(110 N BED)|(110 BED)|(502 N FRA)|(502 FRA)|(439 E CA)|' + 
        '(633 LAN)';


    const NOT_COMMON_APT_OR_DORM_ALL_BUT_EH_AND_SH = {
        $and: [
            { addr1: { $not: { $regex: commonApt }} }, // 不住common apt
            { area: { $ne: 1 } }, // 不住宿舍
            { area: { $ne: 2 } }, // 不住Sheboygan
            { area: { $ne: 3 } }, // 不住Eagle Heights
        ]
    };

    const newList = await User.find(NOT_COMMON_APT_OR_DORM_ALL_BUT_EH_AND_SH);

    for (const user of newList) {

        let emailContent = mustache.render(templates.userSparse, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3,
            isNewUser: !user.linkViewed && user.need
        });
    
        const response = await mailgun.send({
            subject: '健康包领取须知',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

async function sendMailTheFrances(i) {

    const newList = await User.find({ addr1: {$regex: '215 N FR'} });

    for (const user of newList) {

        let emailContent = mustache.render(templates.userFrances, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3,
            isNewUser: !user.linkViewed && user.need
        });
    
        const response = await mailgun.send({
            subject: 'The Frances住户请注意：健康包将递送至您的房门口',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

async function sendMailTheFrances(i) {

    const newList = await User.find({ addr1: {$regex: '215 N FR'} });

    for (const user of newList) {

        let emailContent = mustache.render(templates.userFrances, {
            name: user.name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus: user.area === 0 || user.area === 1 || user.area === 4,
            isSheboygan: user.area === 2,
            isEagleHeights: user.area === 3,
            isNewUser: !user.linkViewed && user.need
        });
    
        const response = await mailgun.send({
            subject: 'The Frances住户请注意：健康包将递送至您的房门口',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

async function sendMailDelivered(i) {

    const newList = await User.find({ delivered: false, area: { $le: 4 } });

    for (const user of newList) {

        const { name, area, wechat } = user;
        const isOnCampus = area === 0 || area === 1 || area === 4;
        const isSheboygan = area === 2;
        const isEagleHeights = area === 3;

        // Send email
        let emailContent = mustache.render(templates.sunday, {
            name,
            url: `https://relief.cssawisc.org/user/${encode(wechat)}`,
            isOnCampus,
            isSheboygan,
            isEagleHeights,
        });

        // const response = await mailgun.send({
        //     subject: '健康包',
        //     to: user.email,
        //     html: emailContent
        // });
        const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}

/**
 * 发给在麦迪逊附近但是周六没有领取的人
 */
async function sendMailNearMadisonNoDelivery(i) {
    const newList = await User.find({ delivered: false, area: { $lte: 4 } });

    for (const user of newList) {

        const { name, area } = user;
        const isOnCampus = area === 0 || area === 1 || area === 4;
        const isSheboygan = area === 2;
        const isEagleHeights = area === 3;

        // Send email
        let emailContent = mustache.render(templates.sunday, {
            name,
            url: `https://relief.cssawisc.org/user/${encode(user.wechat)}`,
            isOnCampus,
            isSheboygan,
            isEagleHeights,
        });

        const response = await mailgun.send({
            subject: '健康包：上门派发通知',
            to: user.email,
            html: emailContent
        });
        // const response = { message: 'FOUND' };
    
        console.log(++i, user.email, response.message);
    }
}





function encode(text) {
    let iv = Buffer.from(IV, 'hex');
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(KEY), iv);
    let encrypted = cipher.update(text);
   
    encrypted = Buffer.concat([encrypted, cipher.final()]);
   
    return encrypted.toString('hex');
}

module.exports = {
    dataForArea0, 
    findAddressWithNoRoomNum, 
    print, sendMail, 
    sendMailStd, 
    sendMailNotMadison, 
    sendMailRetry, 
    updateUserLate,
    sendMailUnread,
    sendMailNewUsersInDormsOrCommonApt,
    sendTestMail,
    sendMailAllEagleHeights,
    sendMailAllSheboygan,
    sendMailNewUsersInOtherApartmentsOnOrOffCampus,
    sendMailTheFrances,
    sendMailDelivered,
    sendMailNearMadisonNoDelivery
};
