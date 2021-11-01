import { Request, Response } from 'express'
import { array_merge, base64_decode, base64_encode, copy_object, decrypt__data, empty, encrypt_md5, encrypt__data, get_message_template, get_utc_timestamp, intval, is_empty, makePaySn, randomString, rsort, send_email, serialize, trim_phone, unserialize, unset, usort } from '../helpers/misc';
import { isObject } from 'lodash';
import { settingService } from '../services/setting.service';
import { userService } from '../services/user.service';
import BaseController from './base.controller';
import { curl_form_urlencoded, curl_get, curl_post, curl_post_json } from '../helpers/curl';
import { nmi } from '../library/nmi';
import { BASE_URL, FRONT_LOGIN_URL } from '../var/env.config';
import { APP_NAME, JWT_SECRET, LICENSE_TRIAL_PRICE } from '../var/config';
import { Logger } from '../library/logger';
import * as querystring from 'query-string';
import * as jwt from "jsonwebtoken";
import { RowDataPacket } from 'mysql2';

export default class IndexController extends BaseController {
  constructor() {
    super();
  }

  public init = (req: Request, res: Response): void => {
    this.setReqRes({ req: req, res: res });
  }

  /********************************************** main controllers **************************************************************/

  //api for get app setting : GET
  public test = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
   
    const pay_sn:string = makePaySn(1);
    console.log('pay_sn', pay_sn);
    console.log('connection.remoteAddress', this.get_ip())
    Logger.info("test info log");
    Logger.error("test qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
    Logger.debug("debug qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq")
    // const api_url: string = "https://higherlevelfx.com/home/register"
    // const params = {aaa:'bbb', ccc:'ddd'}
    // const { statusCode, data, headers } = await curl_post_json(api_url, params);
    // console.log('----{ statusCode, data, headers }-----', statusCode, data, headers)
    // Logger.debug(statusCode)
    // Logger.debug(data)
    // let invoice_number = "1111222233333";
    // let message = get_message_template(2, true);
    // message = message.replace("%%subject%%", "Test subject");
    // message = message.replace("%%user_name%%", "UserName");
    // message = message.replace("%%product%%", "product_name");
    // message = message.replace("%%invoice_number%%", "invoice_number");
    // message = message.replace("%%customer_username%%", "user_info_name");
    // message = message.replace("%%login_url%%", FRONT_LOGIN_URL);
    // message = message.replace("%%subtotal_price%%", 1);
    // message = message.replace("%%total_price%%", 1);
    // message = message.replace("%%recurring_subtotal_price%%", 1);
    // message = message.replace("%%recurring_total_price%%", 1);

    // send_email("kdcsev113@gmail.com", "Test subject", message);

    // let post_data = {
    //   action: 'UpdateUser',
    //   user_id: 1,
    //   responsetype: 'json',
    //   action1: 'UpdateUser',
    //   user_id1: 1,
    //   responsetype1: 'json',
    // }
    // let new_data =  [1,2,3,4,5];
    // let subject = "Order Confirmation!";
    // let product_name = "Software License";
     
    // let invoice_number = "123454321";
    // let user_info = {
    //   user_name:"Quansssss",
    //   user_email:"quanseng632@gmail.com"
    // }
    // let params = {
    //   amount:100
    // }
    // let message = get_message_template(2);
    // message = message.replace("%%subject%%", subject);
    // message = message.replace("%%user_name%%", user_info['user_name']);
    // message = message.replace("%%product%%", product_name);
    // message = message.replace("%%invoice_number%%", invoice_number);
    // message = message.replace("%%customer_username%%", user_info['user_name']);
    // message = message.replace("%%login_url%%", FRONT_LOGIN_URL);
    // message = message.replace("%%subtotal_price%%", params['amount']);
    // message = message.replace("%%total_price%%", params['amount']);
    // message = message.replace("%%recurring_subtotal_price%%", params['amount']);
    // message = message.replace("%%recurring_total_price%%", params['amount']);
    // send_email(user_info['user_email'], subject, message);

    // let rank_list = await userService.getAll({id: 3});
    // rank_list = <RowDataPacket>[];

    // console.log('rank_list', rank_list)

    let new_data =  [1,2,3,4,5];
    let new_data1 =  {aaa:"aaaaaaaaa", bbb: "bbbbbbbbbbbbbbbb"};
    let new_data2 = [{aaa: 1, bbb:2},{aaa: 8, bbb:3},{aaa: 5, bbb:4}]
    //new_data = usort(new_data2, "aaa")
    //new_data = copy_object(new_data2);
    new_data = array_merge(new_data, new_data2);
    this.json_output_data(new_data);
  };

  public index = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
   
    this.json_output_data("aaaa");
  };

  public license = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
   
    this.json_output_data("aaaa");
  };

}

export const indexController = new IndexController()
