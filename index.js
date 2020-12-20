const Whatsapp = require('venom-bot');
const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const sessionId = uuid.v4();
const fs = require('fs');
const util = require('util');
const fsp = util.promisify(fs);
const mime = require('mime-types');
const projectId = 'aquiIdAgente';

const sessionClient = new dialogflow.SessionsClient({ keyFilename: 'aquiVaiCodigo.json' });

Whatsapp.create(
    'API-Whatsapp',
    (base64Qrimg, asciiQR, attempts, urlCode) => {
        //console.log('Number of attempts to read the qrcode: ', attempts,'\n');
        // console.log('Terminal qrcode: ', asciiQR);
        // console.log('base64 image string qrcode: ', base64Qrimg);
        // console.log('urlCode (data-ref): ', urlCode);
    },
    (statusSession, session) => {
        console.log('Status Session: ', statusSession, '\n');
        console.log('Session name: ', session, '\n');
    },
    {
        folderNameToken: 'tokens',
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: true,
        browserArgs: ['--no-sandbox'],
        disableWelcome: true,
        updatesLog: false,
        autoClose: 60000,
        createPathFileToken: true
    }
)
    .then((client) => start(client))
    .catch((erro) => {
        console.log(erro);
    });

Whatsapp.defaultLogger.level = 'silly';

function start(client) {
    client.onMessage(async (message) => {
        if ((message.hasMedia === true && message.type === 'audio') || message.type === 'ptt') {
            sendMidiaFromDialogflow(message);
        }
        if (message.type === 'chat') {
            sendFromDialogflow(message.body);
        }

        async function sendFromDialogflow(msg) {
            const sessionPath = await sessionClient.projectAgentSessionPath(projectId, sessionId);
            const request = {
                session: sessionPath,
                queryInput: {
                    text: {
                        text: msg,
                        languageCode: 'pt-BR'
                    }
                }
            };
            const responses = await sessionClient.detectIntent(request);
            console.log('Detected intent');
            const result = await responses[0].queryResult;
            console.log(`  Query: ${result.queryText}`);
            console.log(`  Response: ${result.fulfillmentText}`);
            if (result.fulfillmentText) {
                console.log(`  Intent: ${result.intent.displayName}`);
                client.sendText(message.from, result.fulfillmentText).then((result) => { }).catch((erro) => {
                    console.error('Error when sending: ', erro);
                });
            } else {
                console.log(`  No intent matched.`);
            }
        }

        async function sendMidiaFromDialogflow(msg) {
            const buffer = await client.decryptFile(msg);
            var file = `audio-${Math.random()}.${mime.extension(msg.mimetype)}`;

            await fsp.writeFile(file, buffer, 'base64', (err) => {
                if (err) {
                    console.log(`error: ${err.msg}`);
                    return;
                }
            });
            const readFile = fsp.readFile;
            const sessionPath = await sessionClient.projectAgentSessionPath(projectId, sessionId);
            const inputAudio = await readFile(`./${file}`, 'base64');
            const request = {
                session: await sessionPath,
                queryInput: {
                    audioConfig: {
                        sampleRateHertz: '16000',
                        audioEncoding: 'AUDIO_ENCODING_OGG_OPUS',
                        languageCode: 'pt-BR'
                    }
                },
                inputAudio: await inputAudio
            },
                responses = await sessionClient.detectIntent(request);
            console.log('Detected intent:');
            const result = await responses[0].queryResult;
            console.log(`  Query: ${result.queryText}`);
            console.log(`  Response: ${result.fulfillmentText}`);

            if (await result.fulfillmentText) {
                console.log(`  Intent: ${result.intent.displayName}`);
                client.sendText(msg.from, result.fulfillmentText).then((result) => { }).catch((erro) => {
                    console.error('Error when sending: ', erro);
                });
            } else {
                console.log(`  No intent matched.`);
            }
            fs.unlink(`./${file}`, (error) => {
                if (error) {
                    console.log('Erro ao deletar o arquivo', error);
                }
            });
            
        }
    });
}
