const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  require("dotenv").config();
}

const express = require("express");
const app = express();
const ejs = require("ejs");
const papa = require("papaparse");
const bodyParser = require("body-parser")
const Excel = require('exceljs');
const formidable = require('formidable');

const APP_DIRECTORY = !(SERVER) ? "" : ((process.env.APP_DIRECTORY) ? (process.env.APP_DIRECTORY) : "");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json());

/* Routing Logic */

app.route(APP_DIRECTORY + "/")
  .get(async function (req, res) {
    console.error(new Date().toLocaleString() + " >> Request Object: ");
    let strReq = await stringify(req);
    console.error(JSON.parse(strReq));
    res.send(JSON.parse(strReq));
  })



app.listen(process.env.PORT || 3055, function () {
  console.error(new Date().toLocaleString() + " >> Test Node Mailer running on Port " + ((process.env.PORT) ? process.env.PORT : 3055));
});



/** Helper Funcrions */

async function stringify(obj) {
  let cache = [];
  let str = await JSON.stringify(obj, function(key, value) {
    if (typeof value === "object" && value !== null) {
      if (cache.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  cache = null; // reset the cache
  return str;
}