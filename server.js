const SERVER = !(process.execPath.includes("C:"));//process.env.PORT;
if (!SERVER){
  require("dotenv").config();
}

const express = require("express");
const app = express();
const fs = require("fs");
const ejs = require("ejs");
const papa = require("papaparse");
const bodyParser = require("body-parser")
const Excel = require('exceljs');
const formidable = require('formidable');

const APP_DIRECTORY = !(SERVER) ? "" : ((process.env.APP_DIRECTORY) ? (process.env.APP_DIRECTORY) : "");
const EMAILUSER = process.env.EMAILUSER;
const EMAILPASS = process.env.EMAILPASS;


/** Email Config */
const Imap = require('imap');
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

const imapConfig = {
  user: EMAILUSER,
  password: EMAILPASS,
  host: 'triumphcourier.com', // IMAP server hostname
  port: 993, // IMAP server port (usually 993 for secure SSL/TLS)
  tls: true, // Use SSL/TLS
};

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json());

/* Routing Logic */

app.route(APP_DIRECTORY + "/")
  .get(async function (req, res) {
    console.error(new Date().toLocaleString() + " >> Request Object: ");
    // let strReq = await stringify(req);
    let body = await getEmails().catch(err => {
        console.error("\n\nErrors:");
        console.error(err)
    });
    console.error(body);
    res.send(body);
  })





app.listen(process.env.PORT || 3055, function () {
    console.error(new Date().toLocaleString() + " >> Test Node Mailer running on Port " + ((process.env.PORT) ? process.env.PORT : 3055) + "\n");
});



/** Helper Funcrions */



function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

const getEmails = async () => {
  try {
    // Create an IMAP instance
    const imap = await new Imap(imapConfig);
    imap.once('ready', () => {
        openInbox((err, box) => {
            if (err) throw err;
            imap.search(['UNSEEN'], (err, results) => {
                if (err) throw err;
                const fetch = imap.fetch(results, { bodies: [''], markSeen: true });
                fetch.on('message', (msg, seqno) => {
                    msg.on('body', (stream, info) => {
                        simpleParser(stream, (err, parsed) => {
                            if (err) throw err;

                            const attachments = parsed.attachments;
                            if (attachments.length > 0) {
                            attachments.forEach((attachment) => {
                                if (attachment.contentType === 'text/csv') {
                                const fileName = attachment.filename;
                                const fileContent = attachment.content.toString();

                                // Pass fileName and fileContent to your function here
                                console.log('File Name:', fileName);
                                console.log('File Content:', fileContent);

                                // You can also save the CSV file to disk if needed
                                // fs.writeFileSync(fileName, fileContent);
                                }
                            });
                            }
                        });
                    });
                });

                fetch.once('end', () => {
                    imap.end();
                });
            });
        });
    });

    imap.once('error', (err) => {
    console.error(err);
    });

    imap.once('end', () => {
    console.log('Connection ended');
    });

    // Connect to the IMAP server
    imap.connect();
  } catch (ex) {
    console.log('an error occurred');
    console.error(ex);
  }
};







const main = async () => {
    // Wait until client connects and authorizes
    await client.connect();

    // Select and lock a mailbox. Throws if mailbox does not exist
    let lock = await client.getMailboxLock('INBOX');
    try {
        // fetch latest message source
        // client.mailbox includes information about currently selected mailbox
        // "exists" value is also the largest sequence number available in the mailbox
        // let message = await client.fetchOne(client.mailbox.exists, { source: true });
        // console.error("\n\n **** MSG SOURCE !");
        // console.log(message.source);
        console.error("***  MESAGES \n\n");


        /* */

        // list subjects for all messages
        // uid value is always included in FETCH response, envelope strings are in unicode.
        console.error(" \n\n\n**** BEGIN MESSAGES !");
        for await (let message of client.fetch('5', { source:true })) {
            // console.log(''+message.uid + ' : ' + message.envelope.subject );
            // console.log((message));
            console.log('*\nEMail');
            simpleParser(message.source, async (err, parsed) => {
                // const {from, subject, textAsHtml, text} = parsed;
                console.log(parsed.html);
                return parsed.html;
                /* Make API call to save the data
                   Save the retrieved data into a database.
                   E.t.c
                */
                // return parsed;
              });
            console.log('*************\n\n\n');
            // console.log(`${message.uid}: ${message.envelope.subject}`);
        }
        console.error("*** END MSG  ! \n\n");
    } finally {
        // Make sure lock is released, otherwise next `getMailboxLock()` never returns
        lock.release();
    }

    // log out and close connection
    await client.logout();
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

// simpleParser(stream, async (err, parsed) => {
//                 // const {from, subject, textAsHtml, text} = parsed;
//                 console.log(parsed);
//                 /* Make API call to save the data
//                    Save the retrieved data into a database.
//                    E.t.c
//                 */
//                 // return parsed;
//               });