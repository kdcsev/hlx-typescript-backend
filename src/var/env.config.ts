import * as path from 'path'
let dotenvPath = path.resolve(process.cwd(), '.env')
if(dotenvPath === '/.env') {
  dotenvPath = '/var/www/html/backend/dist/.env'
}
console.log('process.cwd()', process.cwd())
console.log('--------dotenvPath---------', dotenvPath)
require('dotenv').config({ path: dotenvPath })

export const {
  PORT,
  DB_HOST,
  DB_USER,
  DB_PWD,
  DB_NAME,
  BASE_URL,
  BASE_FRONT_URL,
  ENVIRONMENT,
  SITE_MODE,
  RANK_CRON_MODE,
  TICKET_IS_LIMITED,
  WHM_FUNC,
  EMAIL_FUNC,
  CRON_FUNC,
  SMS_FUNC,
  SMS_FROM_NUMBER,
  SMS_API_KEY,
  SMS_API_SECRET,
  NMI_IS_LIVE,
  NMI_LIVE_SECRET_KEY,
  NMI_TEST_SECRET_KEY,
  MAILER_TYPE,
  SES_HOST,
  SES_USER,
  SES_PASS,
  SES_SENDER_EMAIL,
  SENDER_EMAIL,
  GMAIL_SMTP_USERNAME,
  GMAIL_SMTP_PASSWORD,
  UPLOAD_DIR,
  LOG_DIR,
  ROUTES_DIR,
  MODELS_DIR,
  ASSETS_DIR,
  SSL_PRIVATE_KEY,
  SSL_CHAIN_CERT,
} = process.env

// export const BASE_URL = 'http://localhost:' + PORT;
// export const BASE_FRONT_URL = 'http://localhost:3000/';
// export const FRONT_LOGIN_URL = BASE_FRONT_URL + "login";

// export const ENVIRONMENT = 'development'; //'production'
// export const SITE_MODE = 'test';
// export const RANK_CRON_MODE = 'enabled'; //enabled or disabled

// export const WHM_FUNC = 'disabled'; //enabled or disabled
// export const EMAIL_FUNC = 'disabled'; //enabled or disabled
// export const CRON_FUNC = 'disabled'; //enabled or disabled


// export const NMI_IS_LIVE = "false";
// export const NMI_LIVE_SECRET_KEY = 'w4VGxmcwTfwQ43E5d7t88rXFApGYnS64';
// export const NMI_TEST_SECRET_KEY = 'Dj6274QzuD3Xd857NPUeUxBR7pHJHCC9';

// export const SENDER_EMAIL = "support@higherlevelfx.com";
// export const GMAIL_SMTP_USERNAME = "higher.level.fx223@gmail.com";
// export const GMAIL_SMTP_PASSWORD = "Quan-123##";


export const FRONT_LOGIN_URL = BASE_FRONT_URL + "login";