import * as http from 'http'
import * as https from 'https'
import { BASE_URL, PORT, SSL_CHAIN_CERT, SSL_PRIVATE_KEY } from './var/env.config'
import { Socket } from './socket/socket'
import app from './server'
import { cronIndex } from './cronjob/cron.index'

const fs = require('fs');

let server: http.Server
let httpsServer: https.Server
let socket:any

let options = {};
let base_url: string = BASE_URL
let current_schema = 'http';
if (base_url.includes('https://')) {
  console.log('https.............')
  current_schema = 'https';
  options = {
    key: fs.readFileSync(SSL_PRIVATE_KEY),
    cert: fs.readFileSync(SSL_CHAIN_CERT),
  };

  httpsServer = https.createServer(options, app).listen(PORT)
  httpsServer.on('error', (e: Error) => {
    console.log('Error starting server' + e)
  })

  httpsServer.on('listening', () => {
    console.log(
      `Https Server started on port ${PORT} on env ${process.env.NODE_ENV ||
      'dev'}`,
    )
    //cronEmail.startCron()
  })
} else {
  server = http.createServer(app)
  server.listen(PORT)

  server.on('error', (e: Error) => {
    console.log('Error starting server' + e)
  })

  server.on('listening', () => {
    console.log(
      `Server started on port ${PORT} on env ${process.env.NODE_ENV ||
      'dev'}`,
    )
    //cronEmail.startCron()
  })
}

let export_data: any
if(current_schema === 'https'){
  socket = new Socket(httpsServer)
  export_data = {
    httpsServer,
    socket,
    cronIndex
  }
}else{
  socket = new Socket(server)
  export_data = {
    server,
    socket,
    cronIndex
  }
}

export default export_data