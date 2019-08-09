#!/usr/bin/env node

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const open = require('open');
const env = require('./_env');
const google = require('./_google');
const filesystem = require('./_filesystem');

const init = () => {
  console.log(
    chalk.green(
      figlet.textSync("GoLives Catalog", {
        font: "big",
        horizontalLayout: "default",
        verticalLayout: "default"
      })
    )
  );

  google.init();
};

const askQuestions = () => {
  const questions = [
    {
      name: "FILENAME",
      type: "input",
      message: "What is the import filename?",
      default: "ciam.csv",
      validate: filepath => {
        // Try loading firebase cert file
        if (!filepath || !shell.test('-e', filepath)) {
          console.log(chalk.bgRed(`\nCannot find ${filepath} file, please check the file path`));
          return false;
        }
        return true;
      }
    },
    {
      name: "IMAGES",
      type: "input",
      message: "What is the screenshots folder path?",
      default: "./images",
      validate: filepath => {
        // Try loading firebase cert file
        if (!filepath || !shell.test('-e', filepath)) {
          console.log(chalk.bgRed(`\nCannot find ${filepath} folder, please check the folder path`));
          return false;
        }
        return true;
      }
    },
    {
      name: "CREATOR",
      type: "input",
      message: "Your name? (i.e. John Doe)",
      validate: name => !name ? "Please enter your name :)" : true
    },
    {
      name: "EMAIL",
      type: "input",
      message: "Your SAP email address?",
      validate: email => !email || !email.toLowerCase().endsWith('@sap.com') ? "Please enter your @sap.com email :)" : true
    }
  ];
  return inquirer.prompt(questions);
};

const askConfirmation = (question) => {
  const questions = [
    {
      name: "CONTINUE",
      type: "confirm",
      message: question,
      default: false
    }
  ];
  return inquirer.prompt(questions);
};

const success = filepath => {
  console.log(
    chalk.white.bgGreen.bold(`TODO: Remaining records from ${filepath} will be imported here`)
  );
};

const formatDate = (record, field) => {
  if(Date.parse(record[field])) {
    return new Date(record[field]).toDateString();
  }
  else {
    console.log(chalk.red(`WARNING: Invalid value "${record[field]}" as ${field} for "${record.Implementation}"`));
    return "";
  }
};

const formatRow = (record, nextId, creator, email, imageUrl) => {
  const row = { ...env.template };
  row.Id = nextId;
  // replace template values with csv row values
  env.allFields.forEach(c => {
    if(record[c]) {
      switch(c) {
        case 'KickOffDate':
          row['KickOffDate'] = formatDate(record, 'KickOffDate');
          break;
        case 'GoLiveDate':
          row['GoLiveDate'] = formatDate(record, 'GoLiveDate');
          break;
        case 'Keywords':
          row['Keywords'] = record['Keywords'].split(',').map(i => i.trim());
          break;
        default:
          row[c] = record[c];
      }
    }
  });

  // Validate kickoff
  if(row.KickOffDate && row.GoLiveDate &&
    (new Date(row.KickOffDate) >= new Date(row.GoLiveDate))) {
      console.log(chalk.red(`WARNING: Ignoring invalid KickOffDate: "${row.KickOffDate}" and GoLiveDate: "${row.GoLiveDate}" for "${record.Implementation}"`));
      row['GoLiveDate'] = "";
      row['KickOffDate'] = "";
  }

  row['CreatedBy'] = creator;
  row['CreatedByEmail'] = email;
  row['ImageUrl'] = imageUrl;
  return row;
};

const cancel = () => {
  console.log(chalk.yellow('Import Cancelled :) try again later'));
  process.exit();
};

const run = async () => {
  ////////////////////////////////
  // 1. show script introduction
  ////////////////////////////////
  const successRecords = [];
  const errorRecords = [];
  init();

  ////////////////////////////////
  // 2. request filename
  ////////////////////////////////
  const { FILENAME, CREATOR, EMAIL, IMAGES } = await askQuestions();

  ////////////////////////////////
  // 3. read csv file and transform to json
  ////////////////////////////////
  const records = await filesystem.csvToJson(FILENAME);

  ////////////////////////////////
  // 4. Connect to firebase
  ////////////////////////////////
  console.log(chalk.white('\nConnecting to Catalog database...'));
  const nextId = await google.readFirebase();

  ////////////////////////////////
  // 5. Get screenshot image and format row 1
  ////////////////////////////////
  const image = filesystem.getScreenshot(records[0], IMAGES);
  if(image) {
    console.log(chalk.green('\nMatching screenshot found in:'));
    console.log(image);
  } else {
    cancel();
  }
  let imported = formatRow(records[0], nextId, CREATOR, EMAIL, image);

  ////////////////////////////////
  // 6. Show row #1 and ask confirmation
  ////////////////////////////////
  console.log(chalk.green('\nSample formatted record (row #1) from your file:'));
  console.log(imported);
  const { CONTINUE } = await askConfirmation(`\n\nPlease review JSON formatting above for row #1. Do you want to import this record?`);
  if(!CONTINUE) cancel();

  ////////////////////////////////
  // 7. Import record #1 (test record)
  ////////////////////////////////
  console.log(chalk.white(`\nImporting row #1: '${records[0].Implementation}' into the catalog...`));
  const destinationImage = `images/${new Date().valueOf()}_${records[0].Implementation}.png`;
  const imageUrl = await google.uploadScreenshot(image, destinationImage);
  imported = await google.importRecord(imported, imageUrl);

  if(!imageUrl || !imported) {
    process.exit();
  }
  successRecords[0] = [nextId, destinationImage];

  ////////////////////////////////
  // 8. Request review imported record - record #1
  ////////////////////////////////
  console.log(chalk.green(`\nRecord #1: 'ID: ${imported.Id} - ${imported.Implementation}' imported successfully:`));
  console.log(chalk.grey(`${env.catalogURL}/${nextId}`));
  await inquirer.prompt([{
    name: 'REVIEW',
    message: 'Press any key to open in browser and review...'
  }]);
  await open(`${env.catalogURL}/${nextId}`);

  ////////////////////////////////
  // 9. ask creator if we should continue
  ////////////////////////////////
  const { IMPORT } = await inquirer.prompt([{
    name: 'IMPORT',
    type: "list",
    choices: [
      `NO: Abort the import and delete the 'ID: ${imported.Id} - ${imported.Implementation}' record`,
      'YES: Everything looking good, continue importing remaining records'
    ],
    message: 'Do you want to import the remaining records? IMPORTANT: Only select "YES" if the record #1 was imported successfully and Go-Lives Catalog URL is not broken :)',
    filter: val => val.split(":")[0]
  }]);

  ////////////////////////////////
  // 10. finish process
  ////////////////////////////////
  if(IMPORT==='YES') {
    // show success message
    success(FILENAME);
    process.exit();
  } else {
    let deleted = await google.deleteImage(successRecords[0][1]);
    deleted = await google.deleteRecord(successRecords[0][0]);
    cancel();
  }
};

run();