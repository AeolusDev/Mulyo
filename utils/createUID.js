const generateUniqueId = require('generate-unique-id');

const createUID = () => {
    return generateUniqueId({
        length: 5,
        useLetters: false
    });
};

module.exports = createUID;