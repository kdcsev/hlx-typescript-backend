import { Request, Response } from 'express'
import { ASSETS_DIR, BASE_FRONT_URL, FRONT_LOGIN_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, decrypt__data, empty, encrypt_md5, encrypt__data, floatval, get_data_value, get_message_template, get_utc_timestamp, intval, in_array, isset, is_email, send_email, send_sms } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_LICENSE, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, APP_NAME, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import { referralFundsTankService } from '../../services/referral.funds.tank.service';
import { Logger } from '../../library/logger';
import * as PDFDocument from 'pdfkit';
import { pdfCreator } from '../../library/pdfcreator';

export default class UserTestController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return true // await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public migrate_db_from_php = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    /**************************************************************************************************/
    let sql = "select * from " + TB_USER + " as a where customer_detail_1 <> '' and customer_detail_1 IS NOT NULL";
    sql += " order by a.id asc";
    let user_list = await userService.query(sql)
    for (let key in user_list) {
      let user_info = user_list[key]
      let where = { id: user_info['id'] }
      let customer_detail_str = user_info['customer_detail_1'];
      let customer_detail_obj = JSON.parse(customer_detail_str)
      if (!empty(customer_detail_obj)) {
        let update_data = {
          customer_detail: encrypt__data(customer_detail_obj),
          customer_detail_1: ""
        }
        await userService.update(update_data, where)
      }
    }
    return this.json_output_data(user_list)
  }
  public migrate_db_to_php = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    /**************************************************************************************************/
    let sql = "select * from " + TB_USER + " as a where customer_detail <> '' and customer_detail IS NOT NULL";
    sql += " order by a.id asc";
    let user_list = await userService.query(sql)
    for (let key in user_list) {
      let user_info = user_list[key]
      let where = { id: user_info['id'] }
      let customer_detail_str = user_info['customer_detail'];
      if (!empty(customer_detail_str)) {
        let customer_detail_obj = decrypt__data(customer_detail_str)
        let update_data = {
          customer_detail_1: JSON.stringify(customer_detail_obj)
        }
        await userService.update(update_data, where)
      }
    }
    return this.json_output_data(user_list)
  }
  public migrate_db_for_affiliate = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    /**************************************************************************************************/

    let user_id = get_data_value(get_param, 'user_id');
    let sql = "select id, user_name from " + TB_USER + " where user_type = 1 order by rank_updated_timestamp asc, id asc";
    if (!empty(user_id)) {
      sql = "select id, user_name from " + TB_USER + " where user_type = 1 and id = " + user_id + " order by rank_updated_timestamp asc, id asc";
    }

    let user_list = await userService.query(sql)
    for (let key in user_list) {
      let user_info = user_list[key]
      await userService.update({ rank_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] })
      await userService.upgrade_affiliate_info(user_info);
    }
    return this.json_output_data(user_list)
  }
  public test_func = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    /**************************************************************************************************/
    let result: any
    let action = get_data_value(get_param, 'action');
    if (action === 'test_email') {
      let email = get_data_value(get_param, 'email');
      let subject = "Test subject";
      let message = "message"
      message = get_message_template(0);
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%login_url%%/gi, FRONT_LOGIN_URL);
      message = message.replace(/%%user_name%%/gi, "QuanSeng");
      result = send_email(email, subject, message);
      return this.json_output_data(result)
    } else if (action === 'test_sms') {
      let phone = get_data_value(get_param, 'phone');
      let sms_text = "Your HLX Verification Code is: 123456. Valid for 5 minutes";
      let result = await send_sms(phone, sms_text); //for testing
      if (result) {
        return this.json_output_data(1, "Verification code has been sent to your mobile");
      } else {
        return this.json_output_error("Failed to send verification code");
      }
    } else if (action === 'get_customer_detail') {
      let customer_detail_list = [];
      let sql = "select * from " + TB_USER + " as a where customer_detail <> '' and customer_detail IS NOT NULL";
      sql += " order by a.id asc";
      let user_list = await userService.query(sql)
      for (let key in user_list) {
        let user_info = user_list[key]
        let where = { id: user_info['id'] }
        let customer_detail_str = user_info['customer_detail'];
        if (!empty(customer_detail_str)) {
          let customer_detail_obj = decrypt__data(customer_detail_str)
          customer_detail_list.push({ id: user_info['id'], customer_detail: customer_detail_obj })
        }
      }
      return this.json_output_data(customer_detail_list);
    } else if (action === 'remove_inactive_licenses') {
      let sql = "select a.id as user_id, a.user_name as user_name, a.is_active as is_active, b.id as license_id from users as a join licenses as b on a.id = b.user_id where a.is_active=0 group by a.id";
      let user_list = await userService.query(sql);
      for (let key in user_list) {
        let user_info = user_list[key]
        let where = { user_id: user_info['user_id'] }
        await licenseService.delete(where)
      }
      return this.json_output_data(user_list, "Verification code has been sent to your mobile");
    } else if (action === 'update_user_free_license_status') {
      let sql = "select a.id from " + TB_USER + " as a join " + TB_LICENSE + " as b on a.id = b.user_id where b.license_type = 1 and b.status = '1'";
      sql += " and a.is_active = 1 and a.user_type = 0";
      sql += " group by a.id";
      let user_list = <RowDataPacket[]>await userService.query(sql)
      for (let key in user_list) {
        let user_info = user_list[key]
        let where = { id: user_info['id'] }
        let update_data = { license_status: 2 }
        await userService.update(update_data, where)
      }
      return this.json_output_data(user_list, "update_user_free_license_status");
    } else if (action === 'test_email_template') {
      return await this.test_email_template(req);
    }
  }
  public test_email_template = async (req: Request) => {
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let user_email = get_data_value(get_param, 'user_email');
    let email_type = intval(get_data_value(get_param, 'email_type'))
    let message = get_message_template(email_type);
    let subject = "";
    ///////////////////////////////////////////////////////////////////////////////////////////
    if (email_type === -1) { //send verification email
      subject = "Account activation";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%activation_link%%/gi, "http://test.higherlevelfx.com");
      message = message.replace(/%%user_name%%/gi, "Quanseng");
    } else if (email_type === 0) { //signup
      subject = "WELCOME TO HIGHER LEVEL FX!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%login_url%%/gi, "https://higherlevelfx.com/login");
      message = message.replace(/%%user_name%%/gi, "Quanseng");
    } else if (email_type === 1) { // a personal referral signed up
      subject = "Congratulations! Someone just signed up!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%referral_user_name%%/gi, "Atic Mussman");
    } else if (email_type === 2) { // order confirmation when user buy license
      subject = "Order Confirmation!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%invoice_number%%/gi, "12345678");
      message = message.replace(/%%customer_username%%/gi, "Matin");
      message = message.replace(/%%login_url%%/gi, "http://test.higherlevelfx.com/login");
      message = message.replace(/%%product%%/gi, "Software License");
      message = message.replace(/%%total_price%%/gi, "159");
      message = message.replace(/%%subtotal_price%%/gi, "159");
      message = message.replace(/%%recurring_subtotal_price%%/gi, "159");
      message = message.replace(/%%recurring_total_price%%/gi, "159");
    } else if (email_type === 3) { // order confirmation when user get further software licenses
      subject = "Order Confirmation!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%invoice_number%%/gi, "12345678");
      message = message.replace(/%%customer_username%%/gi, "Matin");
      message = message.replace(/%%login_url%%/gi, "http://test.higherlevelfx.com/login");
      message = message.replace(/%%product%%/gi, "Additional Software License");
      message = message.replace(/%%total_price%%/gi, "159");
      message = message.replace(/%%subtotal_price%%/gi, "159");
      message = message.replace(/%%recurring_subtotal_price%%/gi, "159");
      message = message.replace(/%%recurring_total_price%%/gi, "159");
    } else if (email_type === 4) { // order confirmation when user upgrade to IP
      subject = "Order Confirmation!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%invoice_number%%/gi, "12345678");
      message = message.replace(/%%customer_username%%/gi, "Matin");
      message = message.replace(/%%login_url%%/gi, "http://test.higherlevelfx.com/login");
      message = message.replace(/%%product%%/gi, "IP Package");
      message = message.replace(/%%total_price%%/gi, "159");
      message = message.replace(/%%subtotal_price%%/gi, "159");
      message = message.replace(/%%recurring_subtotal_price%%/gi, "159");
      message = message.replace(/%%recurring_total_price%%/gi, "159");
    } else if (email_type === 5) { // order confirmation when user upgrade to IP
      subject = "You just got paid!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%minimum_withdraw_price%%/gi, "50");
    } else if (email_type === 6) { // reset password
      subject = "Reset your password";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%confirm_password_link%%/gi, "https://test.higherlevelfx.com/confirm");

    } else if (email_type === 7) { // submit ticket answer (only notify)
      subject = "We replied to your ticket!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
    } else if (email_type === 8) { //announcement
      subject = "Announcement from " + APP_NAME;
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%announcement_title%%/gi, "Hello, This is test announcement");
      message = message.replace(/%%announcement_body%%/gi, "announcement body");
    } else if (email_type === 9) { // 2FA confirmation email
      subject = "Confirm it's really you!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%confirm_2fa_link%%/gi, "http://test.higherlevelfx.com/login");
    } else if (email_type === 10) { // ticket message 
      subject = "Ticket replied";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%message%%/gi, "Your license is disabled");
    } else if (email_type === 11) { // withdrawal success email
      subject = "Withdrawal Approved!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
      message = message.replace(/%%withdraw_amount%%/gi, "50");
    }

    else if (email_type === 12) { // card declined (for membership only, not affiliate fee):
      subject = "Your card has been declined!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
    } else if (email_type === 13) { //cancelled (membership only):
      subject = "Your cancellation was successful!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
    } else if (email_type === 14) { // cancelled (affiliate only):
      subject = "Your cancellation was successful!";
      message = message.replace(/%%subject%%/gi, subject);
      message = message.replace(/%%user_name%%/gi, "Quanseng");
    }
    let result = send_email(user_email, subject, message);
    return this.json_output_data(message)
  }

  public test_create_vps_user = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    /**************************************************************************************************/
    let user_id = get_param['user_id'];
    let sql = "select * from " + TB_USER + " as a where id = " + user_id;
    let user_list = await userService.query(sql)
    for (let key in user_list) {
      let user_info = user_list[key];
      console.log('user_info', user_info);
      await this.create_vps_user(user_info)
    }
    return this.json_output_data(user_list)
  }
  private create_vps_user = async (user_info: object) => {
    const [result, output] = await whm.createClientAndOrder(user_info);
    console.log('result, output', result, output)
    if (result) {
      await whm.moduleCreate(user_info['user_email']);
      let user_update_data = {
        vps_status: 1,
        vps_updated_timestamp: get_utc_timestamp()
      }
      await userService.update(user_update_data, { id: user_info['id'] });
      Logger.info(user_info['user_email'] + " vps created");
    } else {
      Logger.error(user_info['user_email'] + " vps creation failed");
      Logger.error(output);
    }
  }

  public create_pdf = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    /**************************************************************************************************/
    let item = {
      invoice_number:'12345678',
      trans_type:'Membership'
    }
    let [pdf_path, pdf_file_name] = await pdfCreator.create_invoice_pdf(item);
    return this.json_output_data(pdf_path)
  }
}

export const userTestController = new UserTestController()
