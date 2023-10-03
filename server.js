const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  require("dotenv").config();
}

const express = require("express");
const app = express();
const fs = require("fs");
const { promisify } = require('util');
const ejs = require("ejs");
const papa = require("papaparse");
const bodyParser = require("body-parser")
const Excel = require('exceljs');
const formidable = require('formidable');
const mongoose = require("mongoose");

const APP_DIRECTORY = !(SERVER) ? "" : ((process.env.APP_DIRECTORY) ? (process.env.APP_DIRECTORY) : "" );
const EMAILUSER = process.env.EMAILUSER;
const EMAILPASS = process.env.EMAILPASS;
const TEMP_FILEPATH = (process.env.TEMP_FILEPATH ? process.env.TEMP_FILEPATH : 'tmp/');
const tempFilePath = TEMP_FILEPATH;
const REPORTS_DB = process.env.REPORTS_DB;
const MONGOURI2 = process.env.MONGOURI2;

const MONGOPASSWORD = process.env.MONGOPASSWORD;
const MONGOUSER = process.env.MONGOUSER;

const MONGOTCS_PASS = process.env.MONGOTCS_PASS;
const MONGOTCS_USER = process.env.MONGOTCS_USER;



// Mongoose Report DB Connection Setup
const reportDB = "mongodb+srv://" + MONGOTCS_USER + ":" + MONGOTCS_PASS + REPORTS_DB;
const reportConn = mongoose.createConnection(reportDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


const reportSchema = new mongoose.Schema({
    _id: Date,
    date: {type:Date, default: new Date()},
    drivers:[{
                driverNumber: Number, 
                manifest:[{
                        brand: String,
                        barcode: String,
                        status: {type:{}, default:null},
                        name: String,
                        street: String,
                        city: String,
                        state: String,
                        country: String,
                }]
            }]
});
const Report = reportConn.model("Report", reportSchema);


var allBrands;




// Mongoose Brands DB Connection Setup
const brandDB = "mongodb+srv://" + MONGOUSER + ":" + MONGOPASSWORD + MONGOURI2;

const brandConn = mongoose.createConnection(brandDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


const brandSchema = new mongoose.Schema({
  _id: String,
  trackingPrefixes: [String], //array of variants of the tracking prefixes
});
const Brand = brandConn.model("Brand", brandSchema);


var allBrands;

/** Email Config */
const { ImapFlow } = require('imapflow');
const {simpleParser} = require('mailparser');
const client = new ImapFlow({
    host: 'triumphcourier.com',
    port: 993,
    secure: true,
    auth: {
        user: EMAILUSER,
        pass: EMAILPASS
    }
});





app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json());

/* Routing Logic */

app.route(APP_DIRECTORY + "/extract")
  .get(async function (req, res) {
    console.error(new Date().toLocaleString() + " >> Request Object: ");
    // let strReq = await stringify(req);
    try{
      let response = await main();
      if(response){
        res.send(response);
      }else{
        res.send({successfull:false, message:"External Error"});
      }
    }catch(err){
        // console.error("\n\nErrors:");
        // console.error(err)
        res.send({successfull:false, error:err, msg:"Report Processing Failed"});
      }
    // console.error(body);
    
  })


app.listen(process.env.PORT || 3055, function () {
    console.error( outputDate() +"Test Node Mailer running on Port " + ((process.env.PORT) ? process.env.PORT : 3055) + "\n");
    cacheBrands();
});



/** Helper Funcrions */
// Replace this function with your own logic to process CSV files
async function processCsvAttachment(fileContent) {
    //   console.log(`Found CSV attachment: ${fileName}`);
    let parsedJSON = papa.parse(fileContent);
    let arrayOfAddress = [];
    let errors = [];
    let totalRecords = 0;

    for (let i = 1; i < parsedJSON.data.length; i++) {
          totalRecords++;
          let jsonAddress = {};
          jsonAddress.Barcode = parsedJSON.data[i][0];
          let brand =  allBrands.filter( (foundBrand) => { return (foundBrand.trackingPrefixes.includes(jsonAddress.Barcode.substring(0,7))) })
          let brandName = (brand === undefined || brand.length == 0)? "## Unregistered Brand ##" : brand[0]._id;
          // console.log("*****");
          // console.log(options);
          // console.log(parsedJSON.data[i][1]);
          // console.log("*****");
            if (jsonAddress.Barcode) {
              //   if (parsedJSON.data[i][1] === options.loaded || parsedJSON.data[i][1] === options.attempted || parsedJSON.data[i][1] === options.delivered) {
            // jsonAddress.lastScan = parsedJSON.data[i][1];
                tempSplitAddress = (parsedJSON.data[i][3] + "").split(".");
                let splitAddress;
                if (tempSplitAddress.includes(" US")) {
                  splitAddress = tempSplitAddress;
                } else {
                  tempSplitAddress.push(" US");
                  // console.log(tempSplitAddress);
                  splitAddress = tempSplitAddress;
                }
                // console.log(splitAddress.includes(" US"));
                // console.log(splitAddress);
                // if (options.extractFor === "roadWarrior" || options.extractFor === "route4me") {
                    if (splitAddress.length > 5) {
                        let country = (splitAddress[5] + "").trim();
                        let countryProcessed = "";
                        let name = ((splitAddress[0] + "").trim()) ? splitAddress[0] : "N/A";
                        let street = (splitAddress[1] + "").trim() + ", " + (splitAddress[2] + "").trim();
                        let city = (splitAddress[3] + "").trim();
                        try{
                            if (country != "UNDEFINED") {
                                countryProcessed = (country.length > 3) ? country.split(" ")[0][0] + country.split(" ")[1][0] : country;
                    
                                // console.log(JSON.stringify(address));
                            }
                        }catch(error){
                            // console.log("errors where found at " + (i + 3));
                            errors.push({name:name, line: (i+1), fullAddress: street + " " +city});
                            // console.log(populateErrors);
                        }

                        jsonAddress = {
                        brand: brandName,
                        barcode: parsedJSON.data[i][0],
                        lastScan: parsedJSON.data[i][1],
                        name: name,//((splitAddress[0] + "").trim()) ? splitAddress[0] : "N/A",
                        // apt:(splitAddress[1]+"").trim(),
                        street: street,// (splitAddress[1] + "").trim() + ", " + (splitAddress[2] + "").trim(),
                        city: city, //(splitAddress[3] + "").trim(),
                        state: (splitAddress[4] + "").trim(),
                        country: countryProcessed,
                    
                        }
                    } else {
                        jsonAddress = {
                        brand: brandName,
                        barcode: parsedJSON.data[i][0],
                        lastScan: parsedJSON.data[i][1],
                        name: ((splitAddress[0] + "").trim()) ? splitAddress[0] : "N/A",
                        street: (splitAddress[1] + "").trim(),
                        city: (splitAddress[2] + "").trim(),
                        state: (splitAddress[3] + "").trim(),
                        country: (splitAddress[4] + "").trim(),
                        }
                    }
                // }
                // console.log(jsonAddress);
                // if (jsonAddress.Name != "undefined" && jsonAddress.Name != " Unknown name") {
                  arrayOfAddress.push(jsonAddress);
                // }

                // console.log("Objects " + parsedJSON.data.length);
                
              // }
            
              
            // });  // end of brand finding
        //   } else {
        //     // console.log("already attempted/delivered");
          }
          
        }
        // console.error(arrayOfAddress);
        // console.error(arrayOfAddress.length);
        // console.error(arrayOfAddress);
        return arrayOfAddress;
}
async function extractCsvAttachments(data) {
    let emails = data.todayEmails;
    let errors = data.errors;
    let today = new Date();
    today.setHours(0,0,0,0);
    drivers = [];
    
    // console.log('Email Count:'+ emails.length);
    // console.log(errors);
    for await (const email of emails) {
      // Check if the attachment is a CSV file
      // console.log("\n*** ParsedEmail ***");
      // console.log(email.parsedEmail.attachments[0]);
      let attachment = email.parsedEmail.attachments[0];
      if (attachment.contentType === 'text/csv' || attachment.contentType === 'text/comma-separated-values') {
        const fileName = attachment.filename;
        const driverNumber = fileName.split('.')[0].split('-')[0]; 
        const fileContent = attachment.content.toString('utf-8');
        
        // Pass the file name and content to your processing function here
          let manifest = await processCsvAttachment(fileContent);
          let driverSearch = drivers.filter((d) => d.driverNumber === driverNumber );
          if(driverSearch.length > 0){
            // console.log("Duplicate Driver Found");
            // console.log(driverSearch);
            let existingManifest = driverSearch[0].manifest;
            let mergedManifests = await mergeManifest(existingManifest, manifest);
            if(mergedManifests){
              let driverIndex = drivers.findIndex(obj => obj.driverNumber === driverNumber);
              if(driverIndex !== -1){
                // console.log(driverIndex);
                drivers[driverIndex].manifest = mergedManifests;
              }
            }else{
              errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Failed to Merge Manifest of Driver: "+driverNumber+""});
            }
          }else{
            drivers.push({driverNumber:driverNumber, manifest:manifest})
          }
          // return true;
      }else{
          errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Incom[atible FileType"});
          // console.error(email.envelope.from[0].address + " sent an incompatible filetype: " + fileName + " '"+attachment.contentType+"' ");
      }
    }
    reportDoc = {_id:today, date:today, drivers:drivers};
    let status = await saveReport(reportDoc);
    if (status){
      return {successfull:true, message:"Manfest Extraction Completed", errors:errors, driverCount:drivers.length};
    }else{
      return {successfull:false, message:"Failed to Extract/Save Report", errors:errors, driverCount:drivers.length};
    }
}

async function saveReport(reportDoc){
    let report = new Report(reportDoc);
    reportExists = await reportDocExists(report);
    // console.log(reportExists);
    if(reportExists){
      let result = await deleteReport(report);
      if(result.deletedCount>0){
        let status = await report.save();
        // console.log(status);
        if(status){
          return true;
        }else{
          return false;
        }
      }else{
        return false;
      }

      // itereate though the report and check for drivers that dont exists
      /*
        let drivers = report.drivers;
        for await(const driver of drivers){
          driverExists = await driverDocExists(report._id, driver);
          // if drivers don't exists, insert the new driver object
          if(!driverExists){
            //insert new driver document
            result = await insertDriverDoc(report._id, driver);
            if(result.successfull){
              console.error(result.doc);
            }else{
              console.error(result.msg);
            }
          }else{
            let newStops = [];
            // if driver already exists, iterate through manifest and check for barcodes that dont exists 
            stops = driver.manifest;
            // console.log(stops);
            for await(const stop of stops){
              barcode = stop.barcode
              result = await driverHasPackage(report._id, driver.driverNumber, barcode); // returns new barcodes that dont exist in driver's manifest
              if(!result){
                newStops.push(stop)
              }
            }
            if(newStops.length>0){
              let insertResult = await insertNewStops(report._id, driver.driverNumber, newStops);
              if(insertResult.successfull){
                console.log("Insert Succesfull");
                return true;
              }else{
                console.log("Insert Failed");
                return false;
              }
            }else{
              console.log("no new stops  ");
              return true;
            }
          }
        }
      */
      // if barcode/stop does not exists upsert into driverDoc, (do a global search if the barcode exists under a diff. driver)
      
      console.log("Aready Exists");
    }else{
      console.log("Does NOT Exists - Saving new report Document");
      let status = await report.save();
      console.log(status);
      if(status){
        return true;
      }else{
        return false;
      }
      
      // .then((err,savedDoc) => {
      //   console.errpr(err);
      //   console.errpr(savedDoc);
      //   console.log("Done Saving");
      //   return true;
      // })
      // .catch(err => {
      //   return false;
      // })
    }
}

async function insertDriverDoc(reportID, driver){
  Report.findOneAndUpdate(
    { _id: reportID },
    { $push: { drivers: driver } },
    { new: true }, // To return the updated document
    (err, updatedDocument) => {
      if (err) {
        // console.error(err);
        return {successfull:false, doc:null, msg:err.message}
      } else {
        // console.log('Updated document:', updatedDocument);
        return {successfull:true, doc:updatedDocument, msg:err.message}
      }
      // mongoose.connection.close(); // Close the Mongoose connection when done
    }
  );
}

async function insertNewStops(reportID, driverNumber, newStops){

  const complexCriteria = {
      _id: reportID,  
      'drivers': {
        $elemMatch: { driverNumber: driverNumber},
      },
  };

  let updateResult = await Report.findOneAndUpdate(
    complexCriteria,
    { $push: { 'drivers.manifest': { $each: newStops } }  },
    { new: true });
    
    // To return the updated document
    console.log(updateResult);
    
    // function (err, updatedDocument) => {
    //   if (err) {
    //     console.error(err);
    //     return {successfull:false, doc:null, msg:err.message}
    //   } else {
    //     console.log('Updated document:', updatedDocument);
    //     return {successfull:true, doc:updatedDocument, msg:err.message}
    //   }
    //   // mongoose.connection.close(); // Close the Mongoose connection when done
    // }
  
}

async function deleteReport(report){
  err = await Report.deleteOne({_id:report._id});
  console.error("Deleting exisitng Report");
  // console.error(err);
  return err;
}

async function reportDocExists(report){
  exist = await Report.exists({_id:report._id});
  return exist;
};

async function driverDocExists(reportID, driver){
  exist = await Report.find({_id: reportID, drivers: { $elemMatch: { driverNumber: driver.driverNumber} }});
  return exist;
};

async function driverHasPackage(reportID, driverNumber, barcode){
  report = await Report.findOne({_id: reportID, drivers: { $elemMatch: { driverNumber: driverNumber} }});
  driver = await report.drivers.find((d) => d.driverNumber === driverNumber);
  // await console.log(driver);
  onlineManifest = driver.manifest;
  // console.log(onlineManifest);

  let exist = await onlineManifest.find((e) => e.barcode === barcode);
  // console.log("Filter Process Is done");
  // console.log(exist);
  
  if(exist){
    return true;
  }else{
    return false;
  }
  
  // for await (const stop of manifest){
  //   console.log(stop.barcode);
  //   if(stop.barcode === barcode){
  //     return true;
  //   }else{
  //     return false;
  //   }
  // }
  // console.log("Jusr finished forloop");
  // return exist;
  // exist = await Report.find({_id: reportID, manifest: { $elemMatch: { barcode: barcode}}  });
};

async function mergeManifest(oldManifest, manifest){
  let finalManifest = oldManifest; 
  for await(const stop of manifest){
    let exists = finalManifest.some((s) => s.barcode === stop.barcode);
    if(!exists){
      // console.log("Barcode does not exist -- Addidng");
      finalManifest.push(stop);
    }
  }
  return finalManifest;
}



const main = async () => {
    // Wait until client connects and authorizes
    try {
      await client.connect();
      // console.log(client.close);
      // return(client);
      console.error("connected to mail server");
      // Select and lock a mailbox. Throws if mailbox does not exist
      let lock = await client.getMailboxLock('INBOX');
        const emails = await client.fetch('1:*', { envelope:true, source:true, flags:true });
        let todaysEmails = [];
        let errors = [];
        for await (let email of emails) {
            let isTodayMail = await isToday(new Date(email.envelope.date));
            if(isTodayMail){
                email.parsedEmail = await simpleParser(email.source);
                let attachment = email.parsedEmail.attachments[0]; 
                let fileName = attachment.filename;
                let todaysManifest = await isTodaysManifest(fileName);
                let validFileName = await isValidFileName(fileName);
                if(validFileName){
                    if(todaysManifest){
                        todaysEmails.push(email);
                    }else{
                        errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Outdated Manifest"});
                        // console.error(email.envelope.from[0].address + " sent an outdated manifest: " + fileName + " '"+attachment.contentType+"' ");
                    }
                }else{
                        errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Mutilated FileName"});
                        // console.error(email.envelope.from[0].address + " sent an outdated manifest: " + fileName + " '"+attachment.contentType+"' 
                }
            }
        }
        if (todaysEmails.length > 0){
            console.error(new Date().toLocaleString() + " >> Manifest Extraction Started ...");
            let result = await extractCsvAttachments({todayEmails:todaysEmails,errors:errors});
            if(result.successfull){
                console.log('extraction and upload completed');
                return result
            }
        }else{
          console.error("No New Data for Today");
          // console.error("FInishing and Exiting Mail Connection");
          return ({successfull: true, msg: 'No New Data for Today'});
        }
    } catch(error){
      console.error(outputDate() + "Caught an Error in 'MAIN' function");
      console.error(error);
  
      return ({successfull: false, msg:'Encountered an Error', error:error});

    }finally {
        // Make sure lock is released, otherwise next `getMailboxLock()` never returns
        try{
          lock.release();
          // log out and close connection
          await client.logout();
        }catch(error){
          console.error("Caught errors trying to close the connection");
          // return ({successfull: false, msg:'Closing Error ', error:error})
        }
      }
      
};

//Stringify handles some characters that will cause erroes when passing to a reuest JSON object to string
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

async function isTodaysManifest(fileName){
    let fileNameSplit = fileName.split('.')[0].split('-');
    let manifestDate = new Date(fileNameSplit[2],(fileNameSplit[3]) - 1, fileNameSplit[4]);
    return isToday(manifestDate);
}

async function isValidFileName(fileName){
    let fileNameSplit = fileName.split('.')[0].split('-');
    return fileNameSplit.length > 3;
}


async function isToday(dateToCheck) {
  const currentDate = new Date();
  
  // Set both dates to midnight to compare only the date portion
  currentDate.setHours(0, 0, 0, 0);
  dateToCheck.setHours(0, 0, 0, 0);
  return dateToCheck.getTime() === currentDate.getTime();
}

async function cacheBrands(){
    allBrands = await Brand.find({},"-__v");
    stringBrands = JSON.stringify(allBrands);
    // reCon = JSON.parse(stringRoutes);
    // console.log(reCon);
    fs.mkdir(tempFilePath, (err) => {
        if (err) {
        // console.log(err.message);
        // console.log(err.code);
        if (err.code === "EEXIST") {
            if(SERVER) 
            console.error("Directory ALREADY Exists.");
            fs.writeFile(tempFilePath + 'brands.txt', stringBrands, err => {
                if (err) {
                console.error(err);
                }else{
                if(SERVER) 
                console.error("Brands written to file");
                }
            }); 
        } else {
            console.error(err.code);;
            console.error(err);;
        }
        }else{
        fs.writeFile(tempFilePath + 'brands.txt', stringBrands, err => {
            if (err) {
            console.error(err);
            }else{
            console.log("Brands written to file");
            }
        }); 
        console.log("'/tmp' Directory was created.");
        }
    });
}


async function clearTempFolder(){
  fs.readdir(tempFilePath, (err, files) => {
  if (err) throw err;

  for (const file of files) {
    if(file.startsWith("bra")){
      fs.unlink(path.join(tempFilePath, file), (err) => {
        if (err) throw err; 
      });
    }
  }
});
}



async function keepAlive(){
  interval = 3600000;
  count = 1;
  console.error(outputDate()+"Keep Alive Service Initiated, [Interval: "+ interval/60000+" mins]");
  startDate = new Date(2023,10,03);
  while (startDate.getDate() < 5) {
    console.log(outputDate() + "Keep Alive Ping: " + count++);
    await new Promise( function(resolve,reject){
      setTimeout(resolve, interval)//1hr
    });
  }
}

function outputDate() {
  return (new Date().toLocaleString()) + " >> ";
}
