import * as bodyParser from 'body-parser'
import * as cookieParser from 'cookie-parser'
import * as express from 'express'
import * as logger from 'morgan'
import * as path from 'path'
import * as formidable from 'express-formidable'

import { MODELS_DIR, ROUTES_DIR } from '../var/env.config'
import { globFiles } from '../helpers/misc'
 

const app: express.Express = express()

//for cros origin
app.use(function(req, res, next) {
  //res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT')
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Request-With, X-CLIENT-ID, X-CLIENT-SECRET')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  next()
})

let modelsDir = MODELS_DIR
if(modelsDir === ""){
  modelsDir = "./dist/models/**/*.js"
}

for (const model of globFiles(modelsDir)) {
  require(path.resolve(model))
}

//DB && connect(DB)

app.set('views', path.join(__dirname, '../../src/views'))
app.set('view engine', 'pug')

app.use(logger('dev'))
app.use(formidable({ multiples: true, maxFileSize: 9900000000000 })); //////////////////////
// app.use(express.json())
// app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, '../../src/public')))
//app.use('/uploads/ticket', express.static(path.join(__dirname, '../../src/public/uploads/ticket')));

console.log('----------ROUTES_DIR------------', ROUTES_DIR)
let routesDir = ROUTES_DIR
if(routesDir === ""){
  routesDir = "./dist/routes/**/*.js"
}

for (const route of globFiles(routesDir)) {
  require(path.resolve(route)).default(app)
}

export default app
