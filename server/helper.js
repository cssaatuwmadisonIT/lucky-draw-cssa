'use strict';

const crypto = require('crypto');
const { KEY, IV } = require('./settings.json');

exports.encode = function encode (text) {
    let iv = Buffer.from(IV, 'hex');
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(KEY), iv);
    let encrypted = cipher.update(text);
   
    encrypted = Buffer.concat([encrypted, cipher.final()]);
   
    return encrypted.toString('hex');
}
   
exports.decode = function decode(text) {
    try {
        let iv = Buffer.from(IV, 'hex');
        let encryptedText = Buffer.from(text, 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY), iv);
        let decrypted = decipher.update(encryptedText);
    
        decrypted = Buffer.concat([decrypted, decipher.final()]);
   
        return decrypted.toString();
    } catch (e) {
        return '';
    }
}
