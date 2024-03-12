const { fileSync } = require("tmp");
const { writeSync } = require("fs");

const createCrdentialFile = async (firebaseServiceAccount) => {
  const temporaryFileObject = fileSync({ postfix: ".json" });
  writeSync(temporaryFileObject.fd, firebaseServiceAccount);
  return temporaryFileObject.name;
};

module.exports = { createCrdentialFile };
