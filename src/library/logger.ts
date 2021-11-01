import * as winston from 'winston'
import * as path from 'path'
import DailyRotateFile = require('winston-daily-rotate-file')
import { LOG_DIR } from '../var/env.config'

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const level = () => {
  const env = process.env.NODE_ENV || 'development'
  const isDevelopment = env === 'development'
  return isDevelopment ? 'debug' : 'warn'
}

// const colors = {
//   error: 'red',
//   warn: 'yellow',
//   info: 'green',
//   http: 'magenta',
//   debug: 'white',
// }

// winston.addColors(colors)

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)
let logger_Dir = path.resolve(__dirname, "../../src/public/logs"); 
if(LOG_DIR!==""){
  logger_Dir = LOG_DIR;
}
const loggerDir = logger_Dir
//console.log('------------__dirname-----------', __dirname)
console.log('------------loggerDir-----------', loggerDir)

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: loggerDir + '/error.log',
    level: 'error',
  }),
  new DailyRotateFile({level: 'info', filename: loggerDir + '/hlx-info-%DATE%.log'}),
  new winston.transports.File({ filename: loggerDir + '/all.log' }),
]

export const Logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
})


///how to use
/// Logger.info("test info log");
/// Logger.error("test qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
/// Logger.debug("debug qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq")