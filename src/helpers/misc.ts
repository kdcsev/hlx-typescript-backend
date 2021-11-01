import { sync } from 'glob'
import { isArray, isEmpty, isObject, random, union } from 'lodash'
import * as CryptoJS from 'crypto-js';
import * as lib_number_format from "number_format-php";
import * as nodemailer from 'nodemailer';
import * as path from 'path'
import * as fs from 'fs';
import { forEach } from 'lodash'
import { sprintf } from 'sprintf-js';
import { APP_NAME, ENCRYPT_HASH_KEY } from '../var/config';
import { readFileSync } from 'fs';
import { ASSETS_DIR, BASE_FRONT_URL, BASE_URL, EMAIL_FUNC, GMAIL_SMTP_PASSWORD, GMAIL_SMTP_USERNAME, MAILER_TYPE, SENDER_EMAIL, SES_HOST, SES_PASS, SES_SENDER_EMAIL, SES_USER, SMS_API_KEY, SMS_API_SECRET, SMS_FROM_NUMBER, SMS_FUNC, UPLOAD_DIR } from '../var/env.config';
import { Logger } from '../library/logger';
import { curl_post, curl_post_json } from './curl';

export const globFiles = (location: string): string[] => {
  return union([], sync(location))
}
export const is_empty = (value: any): boolean => {
  if (value === undefined || value === null || value == '' || value === false) {
    return true;
  } else {
    return false;
  }
}
export const empty = (value: any): boolean => {
  let res = is_empty(value)
  //return res;
  if (!res) { //if value is not empty (res is false)
    if (Array.isArray(value)) {
      return value.length === 0
    } else if (isObject(value)) {
      return isEmpty(value)
    } else {
      return false
    }
  } else {
    return true
  }
}
export const isset = (value: any): boolean => {
  if (value === undefined || value === null) {
    return false;
  } else {
    return true;
  }
}
export const is_null = (value: any): boolean => {
  if (value === undefined || value === null) {
    return true;
  } else {
    return false;
  }
}
export const intval = (value: any): number => {
  if (empty(value)) {
    return 0;
  } else {
    let val = parseInt(value)
    return val
  }
}
export const floatval = (value: any): number => {
  if (empty(value)) {
    value = 0;
  }
  let val = parseFloat(value)
  return val
}
export const is_email = (email: string): boolean => {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}
export const trim_phone = ($num: string): string => {
  $num = $num.replace('+', '');
  $num = $num.replace('-', '');
  $num = $num.replace('_', '');
  $num = $num.replace('(', '');
  $num = $num.replace(')', '');
  $num = $num.replace(' ', '');
  $num = $num.replace(/ /g, '');
  return $num;
}
export const get_data_value = (obj: any, key: string, default_value: any = ''): any => {
  if (empty(obj)) {
    return default_value
  }

  if (obj[key] !== undefined) {
    return obj[key]
  } else {
    return default_value
  }
}
export const unset = (myArray: any, key: number | string): any => { //remove item from array
  if (Array.isArray(myArray)) {
    if (typeof key === 'number') {
      myArray.splice(key, 1);
    } else {
      const index = myArray.indexOf(key, 0);
      if (index > -1) {
        myArray.splice(index, 1);
      }
    }
    return myArray
  } else if (isObject(myArray)) {
    delete myArray[key];
    return myArray
  }
  return myArray
}
export const get_boxes = (val: number | string): string => {
  let str = "";
  if (intval(val) > 1) {
    str = "s";
  }
  return str;
}
export const get_utc_timestamp = (): number => {
  let a: number = 0;
  let timestamp: number = new Date().getTime();
  a = Math.floor(timestamp / 1000);//a = Math.floor(Date.now() / 1000);
  return a
}
export const get_time_remain = (delta: number): any => {
  let duration = intval(delta);
  let year = intval(duration / (3600 * 24 * 30 * 365));
  duration = duration - year * 3600 * 24 * 30 * 365;
  let month = intval(duration / (3600 * 24 * 30));
  duration = duration - month * 3600 * 24 * 30;
  let day = intval(duration / (3600 * 24));
  duration = duration - day * 3600 * 24;
  let hour = intval(duration / 3600);
  duration = duration - hour * 3600;
  let minute = intval(duration / 60);
  duration = duration - minute * 60;
  let second = duration;
  let time_str = "just now";
  if (year === 0 && month === 0 && day === 0 && hour === 0 && minute === 0) {
    time_str = "just now";
  } else if (year === 0 && month === 0 && day === 0 && hour === 0) {
    time_str = minute + " minute" + (get_boxes(minute)) + "";
  } else if (year === 0 && month === 0 && day === 0) {
    time_str = hour + " hour" + (get_boxes(hour)) + "";
  } else if (year === 0 && month === 0) {
    time_str = day + " day" + (get_boxes(day)) + "";
  } else if (year === 0) {
    time_str = month + " month" + (get_boxes(month)) + "";
  } else {
    time_str = year + " year" + (get_boxes(year)) + "";
  }
  return time_str;
}
export const get_current_date = () => {
  let date_ob = new Date();
  // current date
  // adjust 0 before single digit date
  let date = ("0" + date_ob.getDate()).slice(-2);
  // current month
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  // current year
  let year = date_ob.getFullYear();
  // current hours
  let hours = date_ob.getHours();
  // current minutes
  let minutes = date_ob.getMinutes();
  // current seconds
  let seconds = date_ob.getSeconds();
  let result = year + "-" + month + "-" + date

  return result
}

export const encrypt_md5 = (str: string | number): string => {
  let new_str = str + "";
  const str_encrypted: string = CryptoJS.MD5(new_str).toString();
  return str_encrypted;
}
export const encrypt__str = (str: string): string => {
  try {
    let ciphertext: string = CryptoJS.AES.encrypt(str, ENCRYPT_HASH_KEY).toString();
    return ciphertext
  } catch (e) {
    Logger.error(e);
    return ''
  }
}
export const decrypt__str = (str: string): string => {
  try {
    let bytes = CryptoJS.AES.decrypt(str, ENCRYPT_HASH_KEY);
    //console.log('bytes', bytes)
    let originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText
  } catch (e) {
    Logger.error(e);
    return ''
  }

}
export const serialize = (mixed_value: any) => {
  var _utf8Size = function (str) {
    var size = 0, i = 0, l = str.length;
    let code: number;
    for (i = 0; i < l; i++) {
      code = str[i].charCodeAt(0) as number;
      if (code < 0x0080) {
        size += 1;
      } else if (code < 0x0800) {
        size += 2;
      } else {
        size += 3;
      }
    }
    return size;
  };
  var _getType = function (inp) {
    var type = typeof inp, match;
    var key;
    if (type === 'object' && !inp) {
      return 'null';
    }
    if (type === "object") {
      if (!inp.constructor) {
        return 'object';
      }
      var cons = inp.constructor.toString();
      match = cons.match(/(\w+)\(/);
      if (match) {
        cons = match[1].toLowerCase();
      }
      var types = ["boolean", "number", "string", "array"];
      for (key in types) {
        if (cons == types[key]) {
          return types[key];
          break;
        }
      }
    }
    return type;
  };
  var type = _getType(mixed_value);
  var val, ktype = '';
  switch (type) {
    case "function":
      val = "";
      break;
    case "boolean":
      val = "b:" + (mixed_value ? "1" : "0");
      break;
    case "number":
      val = (Math.round(mixed_value) == mixed_value ? "i" : "d") + ":" + mixed_value;
      break;
    case "string":
      val = "s:" + _utf8Size(mixed_value) + ":\"" + mixed_value + "\"";
      break;
    case "array":
    case "object":
      val = "a";
      var count = 0;
      var vals = "";
      var okey;
      var key;
      for (key in mixed_value) {
        if (mixed_value.hasOwnProperty(key)) {
          ktype = _getType(mixed_value[key]);
          if (ktype === "function") {
            continue;
          }
          okey = (key.match(/^[0-9]+$/) ? parseInt(key, 10) : key);
          vals += serialize(okey) +
            serialize(mixed_value[key]);
          count++;
        }
      }
      val += ":" + count + ":{" + vals + "}";
      break;
    case "undefined":
    default:
      val = "N";
      break;
  }
  if (type !== "object" && type !== "array") {
    val += ";";
  }
  return val;
}
export const unserialize = (data: any) => {
  var that = this;
  var utf8Overhead = function (chr) {
    var code = chr.charCodeAt(0);
    if (code < 0x0080) {
      return 0;
    }
    if (code < 0x0800) {
      return 1;
    }
    return 2;
  };
  var error = function (type, msg, filename, line) {
    return false//throw new that.window[type](msg, filename, line);
  };
  var utf8_decode = function (str_data) {
    var tmp_arr = [],
      i = 0,
      ac = 0,
      c1 = 0,
      c2 = 0,
      c3 = 0;
    str_data += '';
    while (i < str_data.length) {
      c1 = str_data.charCodeAt(i);
      if (c1 < 128) {
        tmp_arr[ac++] = String.fromCharCode(c1);
        i++;
      } else if ((c1 > 191) && (c1 < 224)) {
        c2 = str_data.charCodeAt(i + 1);
        tmp_arr[ac++] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
        i += 2;
      } else {
        c2 = str_data.charCodeAt(i + 1);
        c3 = str_data.charCodeAt(i + 2);
        tmp_arr[ac++] = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }
    }
    return tmp_arr.join('');
  };

  var utf8_encode = function (argString) {
    var string = (argString + '');
    var utftext = "";
    var start, end;
    var stringl = 0;
    start = end = 0;
    stringl = string.length;
    for (var n = 0; n < stringl; n++) {
      var c1 = string.charCodeAt(n);
      var enc = null;
      if (c1 < 128) {
        end++;
      } else if (c1 > 127 && c1 < 2048) {
        enc = String.fromCharCode((c1 >> 6) | 192) + String.fromCharCode((c1 & 63) | 128);
      } else {
        enc = String.fromCharCode((c1 >> 12) | 224) + String.fromCharCode(((c1 >> 6) & 63) | 128) + String.fromCharCode((c1 & 63) | 128);
      }
      if (enc !== null) {
        if (end > start) {
          utftext += string.substring(start, end);
        }
        utftext += enc;
        start = end = n + 1;
      }
    }
    if (end > start) {
      utftext += string.substring(start, string.length);
    }
    return utftext;
  };
  var read_until = function (data, offset, stopchr) {
    var buf = [];
    var chr = data.slice(offset, offset + 1);
    var i = 2;
    while (chr != stopchr) {
      if ((i + offset) > data.length) {
        return false//error('Error', 'Invalid');
      }
      buf.push(chr);
      chr = data.slice(offset + (i - 1), offset + i);
      i += 1;
    }
    return [buf.length, buf.join('')];
  };
  var read_chrs = function (data, offset, length) {
    var buf;
    buf = [];
    for (var i = 0; i < length; i++) {
      var chr = data.slice(offset + (i - 1), offset + i);
      buf.push(chr);
      length -= utf8Overhead(chr);
    }
    return [buf.length, buf.join('')];
  };
  var _unserialize = function (data, offset) {
    var readdata;
    var readData;
    var chrs = 0;
    var ccount;
    var stringlength;
    var keyandchrs;
    var keys;
    if (!offset) {
      offset = 0;
    }
    var dtype = (data.slice(offset, offset + 1)).toLowerCase();
    var dataoffset = offset + 2;
    var typeconvert = function (x) {
      return x;
    };
    switch (dtype) {
      case 'i':
        typeconvert = function (x) {
          return parseInt(x, 10);
        };
        readData = read_until(data, dataoffset, ';');
        chrs = readData[0];
        readdata = readData[1];
        dataoffset += chrs + 1;
        break;
      case 'b':
        typeconvert = function (x) {
          return parseInt(x, 10) !== 0;
        };
        readData = read_until(data, dataoffset, ';');
        chrs = readData[0];
        readdata = readData[1];
        dataoffset += chrs + 1;
        break;
      case 'd':
        typeconvert = function (x) {
          return parseFloat(x);
        };
        readData = read_until(data, dataoffset, ';');
        chrs = readData[0];
        readdata = readData[1];
        dataoffset += chrs + 1;
        break;
      case 'n':
        readdata = null;
        break;
      case 's':
        ccount = read_until(data, dataoffset, ':');
        chrs = ccount[0];
        stringlength = ccount[1];
        dataoffset += chrs + 2;
        readData = read_chrs(data, dataoffset + 1, parseInt(stringlength, 10));
        chrs = readData[0];
        readdata = readData[1];
        dataoffset += chrs + 2;
        if (chrs != parseInt(stringlength, 10) && chrs != readdata.length) {
          return false//error('SyntaxError', 'String length mismatch');
        }
        readdata = utf8_decode(readdata);
        break;
      case 'a':
        readdata = {};
        keyandchrs = read_until(data, dataoffset, ':');
        chrs = keyandchrs[0];
        keys = keyandchrs[1];
        dataoffset += chrs + 2;
        for (var i = 0; i < parseInt(keys, 10); i++) {
          var kprops = _unserialize(data, dataoffset);
          var kchrs = kprops[1];
          var key = kprops[2];
          dataoffset += kchrs;
          var vprops = _unserialize(data, dataoffset);
          var vchrs = vprops[1];
          var value = vprops[2];
          dataoffset += vchrs;
          readdata[key] = value;
        }
        dataoffset += 1;
        break;
      default:
        return false
        //error('SyntaxError', 'Unknown / Unhandled data type(s): ' + dtype);
        break;
    }
    return [dtype, dataoffset - offset, typeconvert(readdata)];
  };
  return _unserialize((data + ''), 0)[2];
}
export const encrypt__data = (data: object): string => {
  let str: string = encrypt__str(serialize(data))
  return str;
}
export const decrypt__data = (str: string): any => {
  let serialized_str: string = decrypt__str(str)
  if (!is_empty(serialized_str)) {
    let result = unserialize(serialized_str);
    return result
  }
  return false;
}
export const base64_encode = (str: string): string => {
  return Buffer.from(str).toString('base64');
}
export const base64_decode = (str: string): string => {
  return Buffer.from(str, 'base64').toString('ascii')
}
export const number_format = (number: string | number, decimals: number = 0, dec_point: string = '.', thousands_sep: string = ','): string => {
  const number_formatted: string = lib_number_format(number, decimals, dec_point, thousands_sep)
  return number_formatted;
}
export const makePaySn = (member_id: number): string => {
  let rand_str: number = random(10, 99)
  let str: string = rand_str + sprintf('%03d', get_utc_timestamp()) + sprintf('%03d', member_id % 1000)
  return str
}
export const to_array = (obj: any) => {
  let arr = [];
  for (let key in obj) {
    arr.push(obj[key])
  }
  return arr;
}
export const rsort = (arr: any) => {
  if (isArray(arr) || isObject(arr)) {
    if (isObject(arr)) {
      arr = to_array(arr)
    }
    let numArray = [];
    for (let i = 0; i < arr.length; i++) {
      numArray.push(Number(arr[i]))
    }
    numArray.sort(function (a, b) {
      return b - a;
    });
    return numArray
  } else {
    return []
  }
}
export const usort = (arr: any, sort_key: string) => {
  if (isArray(arr) || isObject(arr)) {
    if (isObject(arr)) {
      arr = to_array(arr)
    }
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i]
      arr[i][sort_key] = Number(item[sort_key])
    }
    arr.sort(function (a, b) {
      return b[sort_key] - a[sort_key];
    });
    return arr
  } else {
    return []
  }
}
export const copy_object = (arr: any) => {
  if (isArray(arr) || isObject(arr)) {
    return JSON.parse(JSON.stringify(arr))
  } else {
    return arr
  }
}
export const array_under_reset = (arr: any, reset_key: string, type: number = 1) => {
  if (isObject(arr) || isArray(arr)) {
    let tmp = {};
    for (let key in arr) {
      let v = arr[key]
      if (type === 1) {
        tmp[v[reset_key]] = v;
      } else if (type === 2) {
        if (empty(tmp[v[reset_key]])) {
          tmp[v[reset_key]] = [v];
        } else {
          tmp[v[reset_key]].push(v)
        }
      }
    }
    return tmp;
  } else {
    return arr;
  }
}
export const array_merge = (arr1: any, arr2: any) => {
  let new_arr = [];
  if (isArray(arr1)) {
    for (let key in arr1) {
      new_arr.push(arr1[key])
    }
  }
  if (isArray(arr2)) {
    for (let key in arr2) {
      new_arr.push(arr2[key])
    }
  }
  return new_arr
}
export const in_array = (element: any, arr: any) => {
  if (arr.indexOf(element) >= 0) {
    return true
  } else {
    return false
  }
}
export const encodeHtmlEntity = (str: string) => {
  return str
  //return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const user_default_avatar = (type: number | string = 1) => {
  let file_url = BASE_FRONT_URL + "assets/global/img/default-avatar-" + type + ".jpg";
  return file_url;
}
export const get_message_template = (template_id: number, adjusted_template: boolean = true) => {
  let container_file_path = "assets/global/email_template/email_template.html";
  let file_path = "assets/global/email_template/email_template_" + template_id + ".html";
  if (ASSETS_DIR !== "") {
    container_file_path = ASSETS_DIR + "/global/email_template/email_template.html";
    file_path = ASSETS_DIR + "/global/email_template/email_template_" + template_id + ".html";
  }
  let container_file_content: any;
  let file_content: any;
  try {
    container_file_content = readFileSync(container_file_path, 'utf-8');
    file_content = readFileSync(file_path, 'utf-8');
    //console.log("file", file_content)
  } catch (err) {
    Logger.error(err)
  }
  if (empty(file_content)) {
    return file_content;
  }
  let container_html: string = container_file_content as string;
  let html: string = file_content as string;
  container_html = container_html.replace(/%%email_template_content%%/gi, html);
  if (adjusted_template) {
    let logo_url = BASE_FRONT_URL + 'assets/home/images/logo-email.png';
    container_html = container_html.replace(/%%site_title%%/gi, APP_NAME);
    container_html = container_html.replace(/%%logo_url%%/gi, logo_url);
    container_html = container_html.replace(/%%site_url%%/gi, BASE_FRONT_URL);
  }
  return container_html;
}
export const send_email = (to: string, subject: string, message: string, from_email: string = '', attachments: any = []) => {
  if (EMAIL_FUNC === 'disabled') {
    return true
  }

  if (from_email == "") {
    from_email = SENDER_EMAIL
  }
  let transporter: any;


  if (MAILER_TYPE === "AWS_SES") {
    transporter = nodemailer.createTransport({
      host: SES_HOST,
      port: 465,
      // pool: true,
      secure: true, // use TLS
      auth: {
        user: SES_USER,
        pass: SES_PASS
      }
    });
    from_email = SES_SENDER_EMAIL
  } else {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_SMTP_USERNAME,
        pass: GMAIL_SMTP_PASSWORD
      }
    });
  }

  var mailOptions = {
    from: APP_NAME + '<' + from_email + '>',
    to: to,
    subject: subject,
    html: message
  };
  if (!empty(attachments)) {
    mailOptions['attachments'] = attachments
  }
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      Logger.error(error)
    } else {
      Logger.debug('Email sent: ' + info.response)
    }
  });
  return true
}
export const mail_attachment = (to: string, subject: string, message: string, from_email: string = '', attach_path_arr: any = []) => {
  let attachments = [];
  for (let key in attach_path_arr) {
    let attach_path = attach_path_arr[key]
    let filename = path.basename(attach_path)
    let absolutePath = path.resolve(__dirname, "../../src/public/" + attach_path);
    if (!empty(UPLOAD_DIR)) {
      absolutePath = UPLOAD_DIR + "/" + attach_path
    }
    let dirname = __dirname
    console.log('----------------attach_path, absolutePath----------', attach_path, absolutePath)
    let attachment = {
      filename: filename,
      content: fs.createReadStream(absolutePath)
    }
    attachments.push(attachment)
  }
  console.log('------------------------attachments---------------------', attachments)

  return send_email(to, subject, message, from_email, attachments)
}

export const randomString = (length: number, number_only: boolean = false): string => {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  if (number_only) {
    characters = '0123456789';
  }
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
  }
  return result;
}
export const send_sms = async (to: string, sms_text: string) => {
  if (SMS_FUNC === 'disabled') {
    return true
  }
  to = trim_phone(to);
  if (empty(to)) return false;

  let url = "https://rest.nexmo.com/sms/json";
  let sms_post_data = {
    from: SMS_FROM_NUMBER,
    text: sms_text,
    to: to,
    api_key: SMS_API_KEY,
    api_secret: SMS_API_SECRET
  };
  const { statusCode, data, headers } = await curl_post(url, sms_post_data);
  //Logger.info(JSON.stringify(data))
  console.log('status,data', statusCode, data);
  if (statusCode === 200) {
    try {
      let send_result_obj = data;
      if (!empty(send_result_obj['messages'][0]['status']) && parseInt(send_result_obj['messages'][0]['status']) === 0) {
        return true;
      }
    } catch (e) {
      Logger.error(e)
      return false;
    }

  }
  return false;
}
export const checkPasswordStrenth = (passwordParameter: string, check_type: number = 1): any => {
  let result: boolean = true;
  let strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{6,})') //has at least one lowercase letter (?=.*[a-z]), one uppercase letter (?=.*[A-Z]), one digit (?=.*[0-9]), one special character (?=.*[^A-Za-z0-9]), and is at least eight characters long(?=.{8,}).
  let mediumPassword = new RegExp('((?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{6,}))|((?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])(?=.{8,}))') //The code is the same as for the Strong level only that ?=.{6,} shows that we are checking for at least six characters. It also has | to check for either of the two conditions

  if (check_type === 1) {  //strong checker
    if (!strongPassword.test(passwordParameter)) {
      result = false;
    }
  } else if (check_type === 2) { //mediun checker
    if (mediumPassword.test(passwordParameter)) {
      result = false;
    }
  }
  let message = ""
  if(!result){
    message = "The password must contain at least: 1 uppercase letter, 1 lowercase letter, 1 number, and one special character. Password length must be at least 6 characters."
  }
  return [result, message];
}