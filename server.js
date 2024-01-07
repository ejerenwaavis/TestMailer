const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  require("dotenv").config();
}

const express = require("express");
const app = express();
const fs = require("fs");
// const { promisify } = require('util');
const ejs = require("ejs");
const papa = require("papaparse");
const bodyParser = require("body-parser")
const Excel = require('exceljs');
// const formidable = require('formidable');
const mongoose = require("mongoose");
const cors = require("cors")


const APP_DIRECTORY = !(SERVER) ? "" : ((process.env.APP_DIRECTORY) ? (process.env.APP_DIRECTORY) : "" );
const EMAILUSER = process.env.EMAILUSER;
const TESTMAIL = process.env.TESTMAIL;
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
      lastScan: String,
      barcode: String,
      status: {type:{}, default:null},
      isPriority: {type:Boolean, default:false},
      name: String,
      street: String,
      city: String,
      state: String,
      country: String,
    }]
  }]
});
const Report = reportConn.model("Report", reportSchema);




const driverReportSchema = new mongoose.Schema({
    _id: String, // driverNumber-date
    date: {type:Date, default: new Date().setHours(0,0,0,0)},
    driverNumber: Number,
    driverName: String, 
    driverAllias: String, 
    manifest:[{
        brand: String,
        barcode: String,
        isPriority: Boolean,
        lastScan: String,
        Events: {type:{}, default:null},
        name: String,
        street: String,
        city: String,
        state: String,
        country: String,
    }],
    lastUpdated: {type:Date, default:null},
});
const DriverReport = reportConn.model("DriverReport", driverReportSchema);
var driverReports;






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



const barcodeCacheSchema = new mongoose.Schema({
  _id: String,
  drivers: [{driverNumber:String,lastModified:Date}], //array of variants of the tracking prefixes
  lastModified: Date,
});
const BarcodeCache = reportConn.model("BarcodeCache", barcodeCacheSchema);
var allBarcodeCache = [];


/** Email Config */
const { ImapFlow } = require('imapflow');
const {simpleParser} = require('mailparser');
 


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.json());
app.use("/extract/:dateTime", cors({
  origin: ['http://localhost:3060', 'https://triumphcourier.com'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

/* Routing Logic */

app.route(APP_DIRECTORY + "/extract/:dateTime")
  .get(async function (req, res) {
    // console.error(new Date().toLocaleString() + " >> Request Object: ");
    // let strReq = await stringify(req);
    let reqDateTimeConv = Number(req.params.dateTime);
    let reqDateTime = (reqDateTimeConv != NaN) ? (reqDateTimeConv > 0 ? reqDateTimeConv : new Date().getTime()) : new Date().getTime();
        try{
      console.log("Final Req Date Time:  " + reqDateTime);
      let processedEmails = await extractEmail({targetDate: reqDateTime});
      console.log("\n Switching to local extraction process");
      let response = await processExtractedEmail(processedEmails);
      console.log(response);
      
      if(response){
        res.send(response);
      }else{
        res.send({successfull:false, message:"External Error"});
      }
    }catch(err){
        console.error("\n\nErrors:");
        console.error(err)
        res.send({successfull:false, error:err, msg:"Report Processing Failed"});
      }
    // console.error(body);
    
  })


app.listen(process.env.PORT || 3055, function () {
    console.error( outputDate() + "Test Node Mailer running on Port " + ((process.env.PORT) ? process.env.PORT : 3055) + "\n");
    cacheBrands();
});



/** Helper Funcrions */
// Replace this function with your own logic to process CSV files
async function processCsvAttachment(fileContent, oldDrivers, driverNumber, emailDate) {
  let driverName = await getDriverName(driverNumber);
  console.error(outputDate() + " Processing Manifest for: ", driverName);
  
  let drivers = oldDrivers
    let parsedJSON = papa.parse(fileContent);
    let arrayOfAddress = [];
    let errors = [];
    let totalRecords = 0;
    let date = new Date(emailDate);
    for (let i = 1; i < parsedJSON.data.length; i++) {
      totalRecords++;
      let jsonAddress = {};
      jsonAddress.Barcode = parsedJSON.data[i][0].trim();
      let brand = await allBrands.filter( (foundBrand) => { return (foundBrand.trackingPrefixes.includes(jsonAddress.Barcode.substring(0,7))) })
      let brandName = (brand === undefined || brand.length == 0)? "## Unregistered Brand ##" : brand[0]._id;
      isPriorityPackage = await isPriority(brandName);
      // jsonAddress.isPriority = await isPriority(brandName);
      
      if (jsonAddress.Barcode) { // allow for all stops scanned and unscanned
          tempSplitAddress = (parsedJSON.data[i][3] + "").split(".");
          let splitAddress;
          if (tempSplitAddress.includes(" US")) {
            splitAddress = tempSplitAddress;
          } else {
            tempSplitAddress.push(" US");
            // console.log(tempSplitAddress);
            splitAddress = tempSplitAddress;
          }
          
          if (splitAddress.length > 5) {
              let country = (splitAddress[5] + "").trim();
              let countryProcessed = "";
              let name = ((splitAddress[0] + "").trim()) ? splitAddress[0] : "N/A";
              let street = (splitAddress[1] + "").trim() + ", " + (splitAddress[2] + "").trim();
              let tentativeApt = (splitAddress[1] + "").trim();
                if(tentativeApt.toLowerCase().includes("unit") 
                || tentativeApt.toLowerCase().includes("apt ") 
                || tentativeApt.toLowerCase().includes("apartment")
                || tentativeApt.toLowerCase().includes("suite")
                || tentativeApt.toLowerCase().includes("ste")
                || tentativeApt.toLowerCase().includes("rm")
                || tentativeApt.toLowerCase().includes("room")
                || tentativeApt.length < 5
                ){
                  // console.log("apt string: ", tentativeApt);
                  // console.log("apartment: ", true);
                  street = (splitAddress[2] + "").trim() + ", " + tentativeApt;
                }else{
                  // console.log("apartment : ",false);
                  street = tentativeApt+ ", " + (splitAddress[2] + "").trim() ;
                }
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
                          barcode: (parsedJSON.data[i][0]).trim(),
                          lastScan: (parsedJSON.data[i][1]).trim(),
                          isPriority: await isPriority(brandName),
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
                          barcode: (parsedJSON.data[i][0]).trim(),
                          lastScan: (parsedJSON.data[i][1]).trim(),
                          isPriority: await isPriority(brandName),
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
                  foundBarcode = await allBarcodeCache.find((bc) => bc._id === jsonAddress.barcode )
                  if(foundBarcode){
                    // console.error("Found Existing Barcode: " , foundBarcode._id , " Under: " ,  foundBarcode.drivers);
                    // if(jsonAddress.lastScan === 'Delivered' || jsonAddress.lastScan === 'Attempted' || jsonAddress.lastScan === 'Loaded'){
                    if(jsonAddress.lastScan === 'Delivered' || jsonAddress.lastScan === 'Attempted' || jsonAddress.lastScan === 'Loaded'){
                      for await(const driver of foundBarcode.drivers){
                        const index = drivers.findIndex(i => i.driverNumber === driver.driverNumber);
                        if(index !== -1){
                          //found the driver to pull from
                          // console.error('found the driver index to pull from: ' + index);
                          //modifying passed driver manifest
                          oldManifest = drivers[index].manifest;
                          drivers[index].manifest = await oldManifest.filter((item) => item.barcode !== foundBarcode._id); 
                          // console.error("Driver Number");
                          // console.error("Old Manifest length: " + oldManifest.length);
                          // console.error("New Manifest Length: " + drivers[index].manifest.length);
                          // console.error("New Manifest :");
                          // console.error(drivers[index].manifest);
                        }else{
                          console.error('Did not find driver index to pull from: ' + index);
                        }
                      }
                      // console.log(jsonAddress.name, " ", jsonAddress.street, " : ", jsonAddress.lastScan);
                      // console.log("The above from drivers");
                      const barcodeIndex = allBarcodeCache.findIndex((bc) => bc._id === jsonAddress.barcode);
                      allBarcodeCache[barcodeIndex].drivers.push({driverNumber:driverNumber, lastModified:date});
                      arrayOfAddress.push(jsonAddress);
                    }else{
                      // dont add to manifest cos it is likely not loaded
                      console.log("Not adding to manifest cos already has a lastScan in someonelses and you have no scan on it");
                      // console.log(jsonAddress.name, " ", jsonAddress.street, " : ", jsonAddress.lastScan);
                    }
                  }else{
                    allBarcodeCache.push({_id:jsonAddress.barcode, drivers:[{driverNumber:driverNumber, lastModified:date}]});
                    arrayOfAddress.push(jsonAddress);
                  }
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
        console.error(outputDate() + " Manifest Processing COMPLETED for: ", driverName?.name, " || totalItems: ", arrayOfAddress.length);
        return {manifest:arrayOfAddress, drivers:drivers};
}

async function extractCsvAttachments(data) {
    let emails = data.todayEmails;
    let errors = data.errors;
    let today = data.date ? new Date(data.date) : new Date();
    today.setHours(0,0,0,0);
    drivers = [];
    driverList = [];
    
    console.error(outputDate() + " Extracting CSV's");
    // for await (const em of emails) {
    //   console.error("Email Seq#: "+em.seq + ", From: "+ em.envelope.from[0].name + " | email: " + em.envelope.from[0].address);
    // };
    console.log(data);
    // console.log('\n');  
    // console.log(emails);
    console.error("----Today Emails to be Processed --- " + emails?.length);
    if(emails){
      for await (const email of emails) {
        // Check if the attachment is a CSV file
        // console.log("\n*** ParsedEmail ***");
        let attachments = email.parsedEmail.attachments; // New Attachment process Handles multiple attachements
        let emailDate = email.parsedEmail.date; // New Attachment process Handles multiple attachements
        let subject = email.parsedEmail.subject;
        // console.error(emailDate);
        for await(const attachment of attachments){
          if (attachment.contentType === 'text/csv' || attachment.contentType === 'text/comma-separated-values') {
            const fileName = attachment.filename;
            const driverNumber = fileName.split('.')[0].split('-')[0]; 
            const fileContent = attachment.content.toString('utf-8');
            console.log("now extracting for: " + (await getDriverName(driverNumber)).name);
            // Pass the file name and content to your processing function here
              let processingResult = await processCsvAttachment(fileContent, drivers, driverNumber, emailDate);
              drivers = processingResult.drivers;
              let manifest = processingResult.manifest;
              
              //check if an existing driver exists
              let driverSearch = drivers.filter((d) => d.driverNumber === driverNumber );
              if(driverSearch.length > 0){
                // console.error("Duplicate Driver Found at " + emails.indexOf(email) + " "+ driverSearch[0].driverNumber);
                // console.log(driverSearch);
                //merge old and new manifest together
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
                driverName = await getDriverName(driverNumber);
                driverList.push(driverName.name);
                drivers.push({
                  _id: driverName.driverNumber + "-" + today.getTime(), // driverNumber-date
                  date: today,
                  driverNumber: driverName.driverNumber, 
                  driverName: driverName.name, 
                  driverAllias: (subject ? subject : email.envelope.from[0].name), 
                  manifest:manifest,
                  lastUpdated: null,
                })
              }
              // return true;
          }else{
              errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Incompatible FileType"});
              // console.error(email.envelope.from[0].address + " sent an incompatible filetype: " + fileName + " '"+attachment.contentType+"' ");
          }
        }
      }
    
      console.error("Manifest Extraction Completed, now saving....");
      // reportDoc = {_id:today, date:today, drivers:drivers}; // OldReportDoc Creation to be commented out
      // let saveCacheStatus = await saveBarcodeCache();
      // let status = await saveReport(reportDoc); // // OldReportDoc Saving to be commented out
      let result = {errors:errors, insertedDocs:[], modifications:[]};
      for await (const driver of drivers){
        try{
          res = await insertNewStopsIfNotExist(driver);
          result.modifications = [...result.modifications, ... res.modifications];
          result.insertedDocs = [...result.insertedDocs, ... res.insertedDocs];
          result.errors = [...result.errors, ...res.errors];
        }catch (err){
          result.errors.push(err)
          console.log(err);
        }
      }
      // console.log("end of processing");
      // console.log(result);
      // let result = await //saveBulkItemizedReport(drivers); // New Individualized Saving

      if (result){
        console.log("Result has no errors");
        return {successfull:true, message:"Manfest Extraction Completed", lastExtracted: new Date().toLocaleString(), errors:result.errors, driverCount:drivers.length, drivers:driverList};
      }else{
        // console.log("Errors Found");
        // console.log(result.errors.toString());
        return {successfull:false, message:"Failed to Extract/Save Report", errors:result.errors, driverCount:drivers.length, drivers:driverList};
      }
    }else{
      return {successfull:false, message:"No Emails Sent", errors:errors, driverCount:drivers.length, drivers:driverList};
    }
}


async function saveBulkItemizedReport(drs){
    let drivers = drs;
    try{
      result = await DriverReport.insertMany(drivers, {ordered:true});
      console.log(Object.getOwnPropertyNames(result));
      console.log(error.insertedDocs);
      return {result:result};
    }catch(error){
      console.log("\nResult");
      console.log(error.result);
      console.log("\nInserted Docs");
      console.log(error.insertedDocs);
      if(error.message.includes("duplicate key error")){
        console.log("main report already pulled, start individual process");
        if(error.insertedDocs.length > 0){
          for await(const doc of error.insertedDocs){
            console.log(doc._id);
            drivers = drivers.filter(d => d._id !== doc._id);
          }
          console.log("Now find a way to save these remainig ones");
          console.log(drivers.length);
          for await(const driver of drivers){
           result = await insertNewStopsIfNotExist(driver);
           console.log('done processing new stops');
          }
          //functoin to save individual updates here
        }else{
          for await(const driver of drivers){
           result = await insertNewStopsIfNotExist(driver);
           console.log('done processing new stops');
          }
        }
      }
      // console.log(Object.getOwnPropertyNames(error));
      // 'stack', 'message', 'code', 'writeErrors', 'result', 'insertedDocs'
      return {error:error};
    }
    
}


async function saveBarcodeCache(){
    err = await BarcodeCache.deleteMany({});
      if (err) {
        console.error('Error deleting Barcode Caches:', err);
      } else {
        console.log('All Barcode documents have been deleted, now inserting new cache.');
        BarcodeCache.insertMany(allBarcodeCache, (error, insertedDocs) => {
          if (error) {
            console.error('Error inserting Barcode Caches:', error);
          } else {
            console.log('Barcode CAched Saved successfully:', insertedDocs);
          }
        });
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

async function insertNewStopsIfNotExist(driver){ 
  // inserts new stops to the driver if already exists otherwise inserts a new driver document
  let problemChild = false;
  // if(driver.driverName.includes("Freddy") || driver.driverName.includes("Timothy") || driver.driverName.includes("Kiara") || driver.driverName.includes("Destiny")){
  //   problemChild = true;
  //   console.log("found problem child");
  //   console.log(driver.driverName);
  //   console.log("CSV manifest length: ", driver.mainifest.length);
  //   setTimeout(function() {
  //     // Your code to be executed after 30 seconds
  //     console.log("Continuing.");
  //   }, 45000);
  // }
  existingDoc = await driverReportExists(driver._id);
  let result = {errors:[], insertedDocs:[], modifications:[]}
  let cacheModifications = [];
  let stopCount = 0;
  if(existingDoc){
    for await (const stop of driver.manifest){
      //check if the stop exisits in other saved drivers on mongoDB
      if(!(existingDoc.manifest.some(s => s.barcode === stop.barcode))){
        // console.log("stop does not exist ...subtract first and then add");
        oldStopOwners = await DriverReport.find({ 'manifest': { $elemMatch: { barcode: stop.barcode } }});
        if(oldStopOwners){
          for await(const oldStopOwner of oldStopOwners){
            oldStopOwner.manifest = await oldStopOwner.manifest.filter(os => os.barcode !== stop.barcode);
            // console.log("new manifest length: " + oldStopOwner.manifest.length);
            saveResult = await oldStopOwner.save();
            if(saveResult){
              // console.log("SAVED OLD OWNER SUCCESSFULLY");
              cacheModifications.push({driverName:oldStopOwner.driverName, stopBarcode: stop.barcode, operation:'deleted'})
              existingDoc.manifest.push(stop);
            }else{
              result.errors.push({msg:"Error Saving Old STOP OWNER", stopBarcode:stop.barcode, driverName:oldStopOwner.driverName})
              // console.log("Error SAving OWNER");
            }
          }
        }else{
          // console.log("No Old Owner");
          cacheModifications.push({driverName:existingDoc.driverName, stopBarcode: stop.barcode, operation:'merged'});
          existingDoc.manifest.push(stop);
        }
      }else{
        // console.log("stop Already exisist....skiping");
      }
      stopCount++;
      if(problemChild){
        console.log(stopCount);
      }
    }
    let saveExistingDocResult = await existingDoc.save();
    if(saveExistingDocResult){
      // console.log("ALL GOOD for EXISTING DOC???");
      result.modifications = cacheModifications;
      // console.log(saveExistingDocResult);
    }else{
      console.log("Some erros occured saving existing doc???");
      // console.log(saveExistingDocResult);
    }
  }else{
    // driver does not exist
    // check if driiver stops exists elsewhere and pull them
    for await(const stop of driver.manifest){
      oldStopOwners = await DriverReport.find({date:driver.date, 'manifest': { $elemMatch: { barcode: stop.barcode } }});
      if(oldStopOwners){
        // console.log("Found Old Owner - ELSE BLOCK");
        // console.log("Pulling stop - ELSE BLOCK");
        for await(const oldStopOwner of oldStopOwners){
          // console.log("old manifest length: " + oldStopOwner.manifest.length);
          oldStop = await oldStopOwner.manifest.find(os => os.barcode === stop.barcode);
          oldStopOwner.manifest = await oldStopOwner.manifest.filter(os => os.barcode !== stop.barcode);
          driverStopIndex = await driver.manifest.findIndex(os => os.barcode !== stop.barcode);
          if(driverStopIndex != -1){
            driver.manifest[driverStopIndex] = oldStop;
          }else{
            driver.manifest.push(oldStop);
          }
          // console.log("new manifest length: " + oldStopOwner.manifest.length);
          saveResult = await oldStopOwner.save();
          if(saveResult){
            // console.log("SAVED OLD OWNER SUCCESSFULLY IN ELSE BLOCK");
            cacheModifications.push({oldOwner:oldStopOwner.driverName, stopBarcode: stop.barcode, operation:'deleted', newStopOwner:driver.driverName})
            // existingDoc.manifest.push(stop);
          }else{
            result.errors.push({msg:"Error Saving Old STOP OWNER", stopBarcode:stop.barcode, driverName:oldStopOwner.driverName})
            // console.log("Error SAving OWNER SUCCESSFULLY");
          }
        }
      }else{
        console.log("No Old Owner");
      }

      stopCount++;
      if(problemChild){
        console.log(stopCount);
      }
    }
    try{
      let newDriverReport = new DriverReport(driver);
      newSaveResult = await newDriverReport.save();
      if(newSaveResult){
        result.insertedDocs.push({driverName:driver.driverName, operation:'instered new Driver'})
        // console.log('saved New Driver successfully');
      }else{
        result.errors.push({msg:"Error Saving New Driver", driverName:driver.driverName});
        // console.log('Failed to save NEW DriverReport ');
      }
    }catch(err){
      console.log("ERROR IN ELSE DRIVER SAVE");
      console.log(err);
      let e = {msg:err, driverName:driver.driverName};
      
    }
    
  }    
  return result;
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

async function driverReportExists(driverReportID){
  exist = await DriverReport.findOne({_id:driverReportID});
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
    let existingStop = finalManifest.find((s) => s.barcode === stop.barcode);
    let stopIndex  = finalManifest.indexOf(existingStop);
    if(!existingStop){
      // console.log("Barcode does not exist -- Addidng");
      finalManifest.push(stop);
    }else{
      // Check if the element was found
        // Manipulate the element (for example, multiply it by 2)
        // console.error("Last Scan Before manipulation:", existingStop.lastScan);
        existingStop.lastScan = stop.lastScan;

        // Update the array with the manipulated value
        finalManifest[stopIndex] = existingStop;
        // console.error("Last Scan after manipulation:", existingStop.lastScan);
    }
  }
  return finalManifest;
}





async function extractEmail(data){
    // Wait until client connects and authorizes
    try {
      client = new ImapFlow({
          host: 'triumphcourier.com',
          port: 993,
          secure: true,
          auth: {
              user: EMAILUSER,
              pass: EMAILPASS
          }
      });
      await client.connect();

      let todaysEmails = [];
      let errors = [];
      let driverList = [];
      let targetDate = data.targetDate ? new Date(data.targetDate) : new Date(); 
      // targetDate.setHours(targetDate.getHours() - 4);

      console.error("connected to mail server...");
            
      const mailbox = await client.mailboxOpen('INBOX');
      console.log("Maiilbox selected");
      console.error(outputDate(), " Target Date: ", targetDate);
      
      
      
      // const emails = await client.fetch('1:*', { envelope:true, source:true, flags:true });
      const emailsUIDS = await client.search({since:targetDate.toISOString(), seen:false});
      console.error(outputDate(), emailsUIDS);
      const emails = await client.fetch(emailsUIDS,{envelope:true, source:true, flags:true })
      // const emails = await client.fetch('1:*', { envelope:true, source:true, flags:true });
      // console.error(outputDate() + "----EMAILS FETCH BELOW---");
      // console.error(emails);
      // console.error("----END OF EMAILS---");
      
      
      
      console.error(outputDate(), "Total Number of emails returned: " + emailsUIDS.length);

      for await (const email of emails) {
          let emailDate = new Date(email.envelope.date);
          let isTodayMail = await isTargetDate(targetDate, emailDate);
          console.log(isTodayMail);
          console.log(emailDate, " ", targetDate);
          if(isTodayMail){
              // console.error("Found Email: ");

              // console.error('email flags');
              // console.error(email.flags);
              // console.error(Object.getOwnPropertyNames(email));

              email.parsedEmail = await simpleParser(email.source);
              let attachments = email.parsedEmail.attachments; 
              for await(const attachment of attachments){
                let fileName = attachment.filename;
                let todaysManifest = await isTargetDateManifest(targetDate, fileName);
                let validFileName = await isValidFileName(fileName);
                if(validFileName){
                  if(todaysManifest){
                    todaysEmails.push(email);
                  }else{
                    errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Outdated Manifest"});
                    // console.error(email.envelope.from[0].address + " sent an outdated manifest: " + fileName + " '"+attachment.contentType+"' ");
                  }
                }else if(attachment.contentType.includes("zip")){
                  errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Invalid File Type"});
                }else{
                  errors.push({sender:email.envelope.from[0].address, fileName:fileName, fileType:attachment.contentType, message:"Mutilated/Invalid FileName or FileType"});
                  // console.error(email.envelope.from[0].address + " sent an outdated manifest: " + fileName + " '"+attachment.contentType+"' 
                }
              }
          }
      }
      if (todaysEmails.length > 0){
          console.log('email Extraction Completed');
          console.error(outputDate() + "Manifest Extraction Started...");
          return {todayEmails:todaysEmails, errors:errors, date:targetDate};
      }else{
        console.error("No New Data for Today");
        // console.error("FInishing and Exiting Mail Connection");
        return ({successfull: true, msg: 'No New Data for Today'});
      }
    } catch(error){
      console.error(outputDate()  + "  Caught an Error in 'EMAIL EXTRACTION' process");
      console.error(error);
  
      return ({successfull: false, msg:'Encountered an internal processing Error', error:errors});

    }finally {
        // Make sure lock is released, otherwise next `getMailboxLock()` never returns
        try{
          // lock.release();
          // log out and close connection
          // await client.logout();
          console.error("Closing Connection");
          await client.close();
        }catch(error){
          console.error("Caught errors trying to close the connection");
          // return ({successfull: false, msg:'Closing Error ', error:error})
        }
      }
      
};



async function processExtractedEmail(processedEmails){
  console.log("Now wroking on processed emails");
  let result = await extractCsvAttachments(processedEmails);
  // console.log(result);
  if(result.successfull){
      console.log('extraction and upload completed');
      // console.log("marking messaages as seen");
      // await client.messageFlagsRemove(emailsUIDS, {uid:true}, ['\\Unseen']);
      return result;
  }else{
      console.log('extraction and upload completed with errors');
      return result
  }
}


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

async function isTargetDateManifest(targetDate, fileName){
    let fileNameSplit = fileName.split('.')[0].split('-');
    let manifestDate = new Date(fileNameSplit[2],(fileNameSplit[3]) - 1, fileNameSplit[4]);

    return isTargetDate(targetDate, manifestDate);
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

async function isTargetDate(targetDate, dateToCheck) {
  const currentDate = new Date(targetDate);
  
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

async function cacheBarcodes(){
    allBarcodeCache = await BarcodeCache.find({},"-__v");
    stringBarcodes = JSON.stringify(allBarcodeCache);
    // reCon = JSON.parse(stringRoutes);
    // console.log(reCon);
    fs.mkdir(tempFilePath, (err) => {
        if (err) {
        // console.log(err.message);
        // console.log(err.code);
        if (err.code === "EEXIST") {
            if(SERVER) 
            console.error("Directory ALREADY Exists.");
            fs.writeFile(tempFilePath + 'allBarcodes.txt', stringBarcodes, err => {
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
        fs.writeFile(tempFilePath + 'allBarcodes.txt', stringBarcodes, err => {
            if (err) {
            console.error(err);
            }else{
            console.log("Barcodes written to file");
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
  console.error(outputDate() + "Keep Alive Service Initiated, [Interval: "+ interval/60000+" mins]");
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

function getToday() {
  return (new Date().toLocaleString()).setHours(0,0,0,0);
}

async function isPriority(brandName) {
  if(priorityBrands != null){
    result = await priorityBrands.some(p => (p.name).toLowerCase() == (brandName).toLowerCase());
    return result;
  }else{
    console.log("Unable to Check for Priority");
    return false;
  }
}

async function getDriverName(driverNumber){
    driver = await (contractors.filter((c) => c.driverNumber === driverNumber))[0];
    return (driver ?  driver : {driverNumber:driverNumber, name:"***" + driverNumber.substring(3)});
}


const priorityBrands = [
  { trackingPrefixes : [], name : 'Eat Clean To Go'},
  { trackingPrefixes : [], name : 'Coldcart, Inc.'},
  { trackingPrefixes : [], name : 'Grip Shipping Inc'},
  { trackingPrefixes : [], name : 'WILD ALASKAN, INC.'},
  { trackingPrefixes : [], name : 'DAILY HARVEST'},
  { trackingPrefixes : [], name : "The Farmer's Dog, Inc."},
  { trackingPrefixes : [], name : 'Butcherbox'},
  { trackingPrefixes : [], name : 'Zara'},
  { trackingPrefixes : [], name : 'Zara Home'}, 
  { trackingPrefixes : [], name : 'SUN BASKET'}, 
  { trackingPrefixes : [], name : 'GOBBLE INC'}, 
  { trackingPrefixes : [], name : 'WALMART'}, 
  { trackingPrefixes : [], name : 'CORPORATE PAYROLL SERVICES'}, 
  { trackingPrefixes : [], name : 'PAYCHEX'}, 
  { trackingPrefixes : [], name : 'ADP'}, 
  { trackingPrefixes : [], name : 'eGourmet Solutions Inc.'}, 
]



contractors = [
  { driverNumber : '203593', name : 'Frankie ROBINSON'},
  { driverNumber : '219029', name : 'Andreea OKONTA'},
  { driverNumber : '227410', name : 'Yacouba NABE'},
  { driverNumber : '230161', name : 'Jones MOORE'},
  { driverNumber : '236765', name : 'Kenya SAMUELS'},
  { driverNumber : '250660', name : 'Susan TAYLOR'},
  { driverNumber : '253249', name : 'Christopher RUFFING'},
  { driverNumber : '253799', name : 'Nestor PUENTES'},
  { driverNumber : '253800', name : 'Mauricio MARULANDA'}, 
  { driverNumber : '255305', name : 'Ana BAZA PAJAROS'},
  { driverNumber : '256956', name : 'Avis EJERENWA'},
  { driverNumber : '257085', name : 'Michael MCKEEVER'},
  { driverNumber : '257137', name : 'Laray KING'},
  { driverNumber : '257275', name : 'Freddy LOZANO'},
  { driverNumber : '257329', name : 'Christopher TAYLOR'},
  { driverNumber : '257398', name : 'Edwin BARHAM'},
  { driverNumber : '257553', name : 'Anthony JACKSON'},
  { driverNumber : '257596', name : 'Joseph JONES'},
  { driverNumber : '257697', name : 'Jonathan GHOLSON'},
  { driverNumber : '258743', name : 'Maria LOZANO'},
  { driverNumber : '258823', name : 'Destiny SMITH'},
  { driverNumber : '258852', name : 'Brenda CANAS MEJIA'},
  { driverNumber : '258828', name : 'Emerald SHEARER'},
  { driverNumber : '258986', name : 'Damon ILER'},
  { driverNumber : '259013', name : 'Jhon PALACIO TINTINAGO'},
  { driverNumber : '259016', name : 'Latasha PALMER'},
  { driverNumber : '259027', name : 'Jorge GUTIERREZ'},
  { driverNumber : '259257', name : 'Lenora TAYLOR'},
  { driverNumber : '259353', name : 'Jessica TAPIA'},
  { driverNumber : '259755', name : 'Lennys CENTENO CORDOVA'},
  { driverNumber : '259908', name : 'Cornealius WHITFIELD'},
  { driverNumber : '259945', name : 'Damien ROBINSON'},
  { driverNumber : '260582', name : 'Natalie ILDEFONSO DIAZ'},
  { driverNumber : '260066', name : 'Mark SEARCY'},
  { driverNumber : '260616', name : 'Marquez JOHNSON'},
  { driverNumber : '260708', name : 'Daiana SERNA SANCHEZ'},
  { driverNumber : '260729', name : 'Antonio REDDING'},
  { driverNumber : '260748', name : 'Timothy BURNS'},
  { driverNumber : '260749', name : 'Malik DAY'},
  { driverNumber : '261126', name : 'Nestor ENRIQUE URDANETA'},
  { driverNumber : '261456', name : 'Jawaun MOSES'},
  { driverNumber : '261486', name : 'Enos MULLINGS'},
  { driverNumber : '261767', name : 'Gia TAYLOR'},
  { driverNumber : '262479', name : 'Shamira LEE JUAREZ'},
  { driverNumber : '262862', name : 'Jamilah TURNER'},
  { driverNumber : '262863', name : 'Keema BRIDGEWATER'},
  { driverNumber : '262942', name : 'Anterio BATEMAN'},
  { driverNumber : '263152', name : 'Maria DUQUE VELEZ'},
  { driverNumber : '263388', name : 'Willie MURRELL JR'},
  { driverNumber : '262946', name : 'Dominique WATSON'},
  { driverNumber : '263442', name : 'Cynthia TORRES'},
  { driverNumber : '263461', name : 'Adina JONES'},
  { driverNumber : '264337', name : 'Annette GAMBLE'},
  { driverNumber : '263976', name : 'Delonte WRIGHT'},
  { driverNumber : '264483', name : 'Philip MADISON'},
  { driverNumber : '264576', name : 'Steven MOTIERAM'},
  { driverNumber : '264505', name : 'Sheafra HAMMETT'},
  { driverNumber : '264774', name : 'Al BAKER'},
  { driverNumber : '264886', name : 'Lionel CAVE'},
  { driverNumber : '264821', name : 'Derick SMITH'},
  { driverNumber : '265078', name : 'Jasmine COGGINS'},
  { driverNumber : '265122', name : 'Cynthia COLLINS'},
  { driverNumber : '265151', name : 'Keisa SULLIVAN'},
  { driverNumber : '265165', name : 'Darrell LAKE JR'},
  { driverNumber : '265219', name : 'Akeem ALCOTT'},
  { driverNumber : '265265', name : 'Brittany SUMLER'},
  { driverNumber : '265289', name : 'Patrick WILLIAMS'},
  { driverNumber : '265400', name : 'John-Thomas GARNER'},
  { driverNumber : '265598', name : 'Moro DIALLO'},
  { driverNumber : '265750', name : 'Sandra MARIN LOZANO'},
  { driverNumber : '265777', name : 'Tyquan WILLIAMS'},
  { driverNumber : '266049', name : 'Michael HAUSER'},
  { driverNumber : '266687', name : 'Kimicion BROWN'},
  { driverNumber : '266122', name : 'Edwin THURANIRA'},
  { driverNumber : '266822', name : 'Ilyas ZOUHEIR'},
  { driverNumber : '267199', name : 'Isemelda JOSEPH DURACIN'},
  { driverNumber : '268645', name : 'Freddy MURILLO'},
  { driverNumber : '268717', name : 'Reshonnah HARVEY'},
  { driverNumber : '268845', name : 'Christian GALVEZ'},
  { driverNumber : '269487', name : 'Justin MCCALLA'},
  { driverNumber : '269640', name : 'Jesus CONTRERAS QUINTERO'},
  { driverNumber : '271385', name : 'Kiara MADDEN'},
  { driverNumber : '271386', name : 'Morris BRATTS'},
  { driverNumber : '271388', name : 'Ronald TORRES BACALAO'},
  { driverNumber : '271464', name : 'Blondy MEDINA'},
  { driverNumber : '271670', name : 'Eliana CORREA MORENO'},
  { driverNumber : '271881', name : 'Joe CEBALLOS'},
  { driverNumber : '272105', name : 'Sadan SYLLA'},
  { driverNumber : '272246', name : 'Angela MOSLEY'},
  { driverNumber : '272595', name : 'Maykelin PEROZO'},
  { driverNumber : '272612', name : 'Shiquita JAMES'},
  { driverNumber : '272883', name : 'Briana HARPER'},
  { driverNumber : '272950', name : 'Tiffany SWANSON'},
  { driverNumber : '273294', name : 'Salena CARTER'},
  { driverNumber : '273985', name : 'Diana PRIETO'},
  { driverNumber : '275899', name : 'Kariela ANEZ ARAUJO'},
  { driverNumber : '277229', name : 'Charles PARKS'},
  { driverNumber : '277253', name : 'Claudancy COEUR'},
  { driverNumber : '278482', name : 'Shekinah DAVIS'},
  { driverNumber : '279195', name : 'Reginald SMITH'},
  { driverNumber : '280413', name : 'Ninozka ZABALA'},
  { driverNumber : '280445', name : 'Danny PRIESTER'},
]