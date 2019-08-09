const {Storage} = require('@google-cloud/storage');
const admin = require('firebase-admin');
const shell = require("shelljs");
const chalk = require("chalk");
const env = require('./_env');

const storage = new Storage({
  projectId: env.projectId,
  keyFilename: "./cert.json"
});

module.exports = {
  init: () => {
    // Try loading firebase cert file
    if (!shell.test('-e', "cert.json")) {
      console.log(chalk.bgRed('Cannot find cert.json file - required to authenticate against the Go-Lives Catalog'));
      process.exit();
    }

    var serviceAccount = require("./cert.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: env.firebaseDBUrl,
      storageBucket: env.storageBucket
    });
  },
  readFirebase: () => {
    return new Promise(resolve => {
      // As an admin, the app has access to read and write all data, regardless of Security Rules
      var db = admin.database();
      var ref = db.ref("/properties");
      ref.on("value", snapshot => {
        const records = snapshot.val();
        resolve((records[records.length - 1].Id) + 1);
      }, err => {
        if(err) {
          console.log(chalk.bgRed(`Error trying to connect to the Catalog: ${err}`));
          process.exit();
        }
      });
    });
  },
  importRecord: (importRow, imageUrl) => {
    return new Promise(resolve => {
      importRow.ImageUrl = imageUrl;
      admin.database().ref(`/properties/${importRow.Id}`).update(importRow, err => {
        if(err) {
          console.log(chalk.bgRed(`Error trying to import a row: ${err}`));
          resolve(null);
        } else {
          resolve(importRow);
        }
      })
    });
  },
  deleteRecord: id => {
    return new Promise(resolve => {
      admin.database().ref(`/properties/${id}`).remove().then(() => {
        console.log(chalk.yellow(`Record firebase ID ${id} deleted successfully`));
        resolve();
      })
      .catch(error => {
        console.log(chalk.bgRed(`Error trying to delete/rollback the firebase ID ${id}: ${error}. Please contact the Go-Lives Catalog admin to manually delete this record`));
        resolve();
      });
    });
  },
  deleteImage: filepath => {
    return new Promise(resolve => {
      storage.bucket(env.storageBucket).file(filepath).delete((err, _) => {
        if(err) {
          console.log(chalk.bgRed(`Error trying to delete/rollback the image ${filepath}: ${err}`));
          resolve(null);
          return;
        }

        console.log(chalk.yellow(`Image file ${filepath} deleted from catalog successfully`));
        resolve(true);
      });
    });
  },
  uploadScreenshot: (filepath, destination) => {
    return new Promise(resolve => {
      storage.bucket(env.storageBucket).upload(filepath, {
        destination: destination,
      }, (err, file) => {
        if(err) {
          console.log(chalk.bgRed(`Error trying to upload the image ${filepath}: ${err}`));
          resolve(null);
          return;
        }

        file.getSignedUrl({
          action: 'read',
          expires: '01-01-2491'
        }).then(signedUrls => {
          resolve(signedUrls[0]);
        });
      });
    });
  }
};
