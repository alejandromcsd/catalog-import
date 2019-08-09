This NodeJS project allows importing records to Firebase and Google Cloud Storage

# How to use
1. Clone the repo to your local machine

```
git clone https://github.com/alejandromcsd/catalog-import.git
```

2. Install dependencies

```
cd catalog-import
npm install
```

3. Copy the cert.json (Google Cloud) credentials to the catalog-import folder

4. Run the import program
```
node import.js
```

# Notes
1. During execution, program will allow you to enter local paths for the following:
* File path for import file in csv format (see template.csv for sample format). Default filepath: "ciam.csv"
* Folder path for Screenshots folder containing PNG images. Default value: "/images"


2. Screenshots rules:
* csv must contain a colum called 'ImageRef'
* images folder should contain a PNG for each row in the csv
* PNG filename should start with 'N - ' where N corresponds to the ImageRef value in the csv

3. csv rules:
* Column/header names are case-sensitive
* Required columns are:
  * Implementation
  * Customer
  * Region
    * (preferred values APJ, EMEA, NA) - correspond to Services team leading project.
  * Keywords
  * Description
  * TechnicalDescription
  * GoLiveDate
  * KickOffDate
  * ImageRef
