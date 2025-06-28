const generateUniqueId = require('generate-unique-id');

const createUID = () => {
    return generateUniqueId({
        length: 5,
        useLetters: false
    });
};

const randomPassword = () => {
    return generateUniqueId({
        length: 10,
        useLetters: true,
        useNumbers: true,
        useSymbols: true
    });
};

module.exports = { createUID, randomPassword };