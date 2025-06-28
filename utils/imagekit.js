const ImageKit = require("imagekit");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKITPUBLICID,
  privateKey: process.env.IMAGEKITPRIVATEKEY,
  urlEndpoint: `https://ik.imagekit.io/${process.env.IMAGEKITID}/`
});

module.exports = imagekit;