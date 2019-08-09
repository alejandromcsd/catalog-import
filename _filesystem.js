const csv = require('csvtojson');
const chalk = require("chalk");
const shell = require("shelljs");
const env = require('./_env');

module.exports = {
  csvToJson: (FILENAME) => {
    return new Promise(resolve => {
      csv().fromFile(FILENAME)
      .on('header', header => {
        // Ensure header is valid
        env.requiredFields.forEach(f => {
          if(!header.includes(f)) {
            console.log(chalk.bgRed(`Your import file does not include the required field: "${f}"`));
            console.log(chalk.red(`Please make sure your header includes the required fields:`));
            console.log(env.requiredFields);
            process.exit();
          }
        });

        // Warning on invalid columns
        const ignored = []
        header.forEach(h => {
          if(!env.allFields.includes(h) && h!=='ImageRef') ignored.push(h);
        });

        if(ignored.length) {
          console.log(chalk.yellow(`\n\nThe following columns from your file will be ignored:`));
          console.log(ignored);
          console.log(chalk.grey(`Did you mean?: ${env.allFields.concat(',')}`));
        }
      })
      .on('error',(err)=>{
        console.log(chalk.bgRed('An error has ocurred while trying to read the .csv import file'));
        console.log(chalk.green('Check example.csv for a valid sample import file'));
      })
      .then(csvRow => resolve(csvRow))
    });
  },
  getScreenshot: (record, imageFolder) => {
    const imageRef = record.ImageRef.length === 1 ? `0${record.ImageRef}` : record.ImageRef;
    const imageFile = `${imageFolder}/${imageRef} - *.png`;
    const image = shell.find(imageFile)[0];
    if (!image) {
      console.log(chalk.bgRed(`\nCannot find a file "${imageFile}", please check your screenshots folder`));
    }
    return image;
  }
};
