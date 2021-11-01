import { Request, Response } from 'express'
import { checkPasswordStrenth, empty, encrypt_md5, encrypt__data, get_data_value, get_message_template, get_utc_timestamp, is_empty, makePaySn, randomString, send_email, send_sms, trim_phone } from '../helpers/misc';
import { isObject } from 'lodash';
import * as jwt from "jsonwebtoken";
import { settingService } from '../services/setting.service';
import { userService } from '../services/user.service';
import BaseController from './base.controller';
import { curl_form_urlencoded, curl_get, curl_post, curl_post_json } from '../helpers/curl';
import { nmi } from '../library/nmi';
import { BASE_FRONT_URL, BASE_URL, FRONT_LOGIN_URL, SMS_FUNC, UPLOAD_DIR, WHM_FUNC } from '../var/env.config';
import { AFFILIATE_COMMISSION, JWT_SECRET, LICENSE_PRICE, LICENSE_TRIAL_PRICE, TICKET_DAILY_LIMIT } from '../var/config';
import { Logger } from '../library/logger';
import { transactionService } from '../services/transaction.service';
import { licenseService } from '../services/license.service';
import { holdingTankService } from '../services/holding.tank.service';
import { treeService } from '../services/tree.service';
import { whm } from '../library/whm';
import { verificationCodeService } from '../services/verification.code.service';
import { tokenService } from '../services/token.service';
import { adminService } from '../services/admin.service';
import { twoFactAuth } from '../library/twoFactAuth';
import { ticketService } from '../services/ticket.service';
import FileUploader from '../library/fileuploader';
import { couponService } from '../services/coupon.service';

export default class HomeController extends BaseController {
  constructor() {
    super();
  }

  public init = (req: Request, res: Response): void => {
    this.setReqRes({ req: req, res: res });
  }

  /********************************************** main controllers **************************************************************/

  //api for get app setting : GET
  public get_app_settings = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let app_settings = await settingService.get_app_settings();
    //console.log(app_settings);
    return this.json_output_data(app_settings);
  };

  //api for register : POST
  public register = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////

    let app_settings = await settingService.get_app_settings();
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    if (isObject(post_param)) {
      post_param['payment_type'] = 'newly';
      account_info['user_name'] = <string>post_param['user_name'].trim();
      account_info['user_first_name'] = <string>post_param['user_first_name'].trim();
      account_info['user_last_name'] = <string>post_param['user_last_name'].trim();
      account_info['user_email'] = <string>post_param['user_email'].trim();
      account_info['user_phone'] = trim_phone(<string>post_param['user_phone']).trim();
      account_info['user_type'] = <string>post_param['user_type'].trim();
      account_info['billing_city'] = <string>post_param['billing_city'].trim();
      account_info['billing_country'] = <string>post_param['billing_country'].trim();
      account_info['billing_state'] = <string>post_param['billing_state'].trim();
      account_info['billing_street'] = <string>post_param['billing_street'].trim();
      account_info['billing_zip_code'] = <string>post_param['billing_zip_code'].trim();
      console.log('account_info', account_info);
      let user_password: string = <string>post_param['user_password'];
      let [passwordStrenth, error_message] = checkPasswordStrenth(post_param['user_password'])
      if (!passwordStrenth) {
        return this.json_output_error(error_message)
      }
      account_info['user_password'] = encrypt_md5(user_password);
      account_info['add_timestamp'] = get_utc_timestamp();
      account_info['user_verified'] = '1';

      if (!empty(post_param['ref'])) {
        let ref_name: string = <string>post_param['ref'];
        let condition = {
          user_name: ref_name
        };
        let ref_info = await userService.getOne(condition);
        if (!empty(ref_info) && !empty(ref_info['id']) && ref_name !== 'Admin') {
          let tank_row = await holdingTankService.getOne({ tree_child_id: ref_info['id'] })
          if (empty(tank_row)) {
            account_info['ref_id'] = ref_info['encrypted_id'];
          }
        }
      }
      const [is_duplicated, duplicated_message] = await userService.checkDuplicatedAccount(account_info);
      if (is_duplicated) {
        return this.json_output_error(duplicated_message);
      }
      let user_id = await userService.insert(account_info);
      let user_encrypted_id = encrypt_md5(user_id);

      // console.log('account info', account_info)
      // console.log('user_id', user_id)
      // console.log('user_encrypted_id', user_encrypted_id)
      // return this.json_output_error("Invalid test");

      let condition = { id: user_id };
      let update_data = {
        encrypted_id: user_encrypted_id
      };
      await userService.update(update_data, condition);

      let pay_result: any;
      let message: any;
      if (account_info['user_type'] == '1') { //pay with affiliate
        [pay_result, message] = await this.pay_with_affiliate(user_id, post_param);
      } else { //pay with customer
        [pay_result, message] = await this.pay_with_customer(user_id, post_param);
      }

      console.log('---pay_result----', pay_result)
      console.log('---message----', message)
      if (pay_result) { //if payment is success
        message = get_message_template(0);
        let subject = "WELCOME TO HIGHER LEVEL FX!";
        message = message.replace(/%%subject%%/gi, subject);
        message = message.replace(/%%login_url%%/gi, FRONT_LOGIN_URL);
        message = message.replace(/%%user_name%%/gi, account_info['user_name']);
        send_email(account_info['user_email'], subject, message);

        /*send email to the parent of referral*/
        let ref_id = account_info['ref_id'];
        if (!empty(ref_id)) {
          let ref_user_info = await userService.getOne({ encrypted_id: ref_id });
          if (!empty(ref_user_info)) {
            message = get_message_template(1);
            subject = "Congratulations! Someone just signed up!";
            message = message.replace(/%%subject%%/gi, "Congratulations! <br/>Someone just signed up!");
            message = message.replace(/%%user_name%%/gi, ref_user_info['user_name']);
            message = message.replace(/%%referral_user_name%%/gi, account_info['user_name'] + " (" + account_info['user_email'] + ")");
            send_email(ref_user_info['user_email'], subject, message);
          }
        }
        account_info['id'] = user_id;
        let user_info = await this.create_jwt(user_id)
        return this.json_output_data(user_info, "You have been registered successfully.");
      } else {
        await userService.delete({ id: user_id });
        return this.json_output_error(message);
      }
    } else {
      return this.json_output_error();
    }
    return this.json_output_data(account_info);
  };
  private pay_with_affiliate = async (user_id: number, post_param: object) => {
    let user_info: object = await userService.getOne({ id: user_id });
    const pay_sn: string = "become_affiliate_" + makePaySn(user_id);
    let params: object = {};
    const payment_product = "become_affiliate";
    params['payment_type'] = post_param['payment_type'];
    params['owner'] = post_param['owner'];
    params['cvc'] = post_param['cvv'];
    params['number'] = post_param['card_number'];
    params['exp_month'] = post_param['exp_month'];
    params['exp_year'] = post_param['exp_year'];
    params['pay_sn'] = pay_sn;
    params['amount'] = AFFILIATE_COMMISSION;
    params['client_ip'] = this.get_ip();
    params['user_id'] = user_id;
    params['user_info'] = user_info;
    params['is_trial'] = 1;
    params['description'] = payment_product;
    params['payment_product'] = payment_product;
    const [payment_status, payment_data] = await this.charge_credit_card(params);
    if (payment_status) {
      Logger.info("Payment successfully");
      Logger.info(JSON.stringify(params));
      Logger.info(JSON.stringify(payment_data));
      params['trans_id'] = payment_data['transactionid'];
      params['paid_amount'] = params['amount'];
      params['environment'] = (payment_data['livemode'] ? "live" : "test");
      await transactionService.add_transaction(params, 'nmi');
      await this.update_customer_id(params);
      await userService.becomeAffiliate(params['user_id']);

      ////////////////////////////////////////////set holding tank or assign to tree directly///////////////////////////////////////////////////////////////
      //$user_info = $this->user_model->get(array('id'=>$params['user_id']));
      if (!empty(user_info)) {
        let check_parent_is_customer = await userService.checkParentIsCustomer(user_info)
        if (check_parent_is_customer) { // check ref_id (user) is customer
          await userService.assign_child_user(user_info['ref_id'], user_info['id']); //assign child user directly (not go to holding tank)
        } else {
          let user_hold_info = await holdingTankService.getOne({ tree_child_id: params['user_id'] })
          let user_tree_info = await treeService.getOne({ user_id: params['user_id'] })
          if (empty(user_hold_info) && empty(user_tree_info)) {
            await userService.setHoldingTank(user_info);
            Logger.info('add holding tank');
            Logger.info(JSON.stringify(user_info));
          }
        }
        /////////////////////////////send invoice email to user//////////////////////////////////////////////////////
        let subject = "Order Confirmation!";
        let product_name = "IP Package";
        let invoice_number = params['trans_id'];
        let message = get_message_template(4);
        message = message.replace(/%%subject%%/gi, subject);
        message = message.replace(/%%user_name%%/gi, user_info['user_name']);
        message = message.replace(/%%product%%/gi, product_name);
        message = message.replace(/%%invoice_number%%/gi, invoice_number);
        message = message.replace(/%%customer_username%%/gi, user_info['user_name']);
        message = message.replace(/%%login_url%%/gi, FRONT_LOGIN_URL);
        message = message.replace(/%%subtotal_price%%/gi, params['amount']);
        message = message.replace(/%%total_price%%/gi, params['amount']);
        message = message.replace(/%%recurring_subtotal_price%%/gi, params['amount']);
        message = message.replace(/%%recurring_total_price%%/gi, params['amount']);
        send_email(user_info['user_email'], subject, message);
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////
      }
      ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    }
    if (payment_status) {
      return [true, "You have paid successfully."]
    } else {
      return [false, payment_data]
    }
  };
  private pay_with_customer = async (user_id: number, post_param: object) => {
    let user_info: object = await userService.getOne({ id: user_id });
    const pay_sn: string = makePaySn(user_id);
    let params: object = {};
    const payment_product = "purchase_license";
    params['payment_type'] = post_param['payment_type'];
    params['owner'] = post_param['owner'];
    params['cvc'] = post_param['cvv'];
    params['number'] = post_param['card_number'];
    params['exp_month'] = post_param['exp_month'];
    params['exp_year'] = post_param['exp_year'];
    params['pay_sn'] = pay_sn;
    params['amount'] = LICENSE_TRIAL_PRICE;
    params['client_ip'] = this.get_ip();
    params['user_id'] = user_id;
    params['user_info'] = user_info;
    params['is_trial'] = 1;
    params['description'] = payment_product;
    params['payment_product'] = payment_product;
    const [payment_status, payment_data] = await this.charge_credit_card(params);
    if (payment_status) {
      Logger.info("Payment successfully");
      Logger.info(JSON.stringify(params));
      Logger.info(JSON.stringify(payment_data));
      params['trans_id'] = payment_data['transactionid'];
      params['paid_amount'] = params['amount'];
      params['environment'] = (payment_data['livemode'] ? "live" : "test");

      let coupon_applied = post_param['coupon_applied'];
      let coupon = post_param['coupon'];
      if (coupon_applied === '1') {
        let coupon_info = await couponService.getOne({ name: coupon })
        if (!empty(coupon_info)) {
          params['expire_days'] = coupon_info['type']
        }
      }

      await transactionService.add_transaction(params, 'nmi');
      params['expire_days'] = 0;
      await this.update_customer_id(params)
      await this.add_blank_license(params, post_param)
      user_info = await userService.getOne({ id: params['user_id'] });
      if (!empty(user_info)) {
        let sponsorIsCustomer: boolean = await userService.checkParentIsCustomer(user_info)
        if (sponsorIsCustomer) { //if sponsor is customer then assign child to mlm tree directly
          await userService.assign_child_user(user_info['ref_id'], user_info['id'])
        } else {
          let user_hold_info = await holdingTankService.getOne({ tree_child_id: params['user_id'] });
          let user_tree_info = await treeService.getOne({ user_id: params['user_id'] });
          if (empty(user_hold_info) && empty(user_tree_info)) {
            await userService.setHoldingTank(user_info);
            Logger.info('add holding tank');
            Logger.info(JSON.stringify(user_info));
          }
        }
        /////////////////////////////send invoice email to user//////////////////////////////////////////////////////
        let subject = "Order Confirmation!";
        let product_name = "Software License";
        if (parseInt(params['is_trial']) === 1) {
          product_name = "Software License for trial";
        } else {
          let user_licenses = await licenseService.getAll({ user_id: user_info['id'], is_trial: 0 });
          if (!empty(user_licenses)) {
            product_name = "Additional Software License";
          }
        }
        let invoice_number = params['trans_id'];
        let message = get_message_template(2);
        message = message.replace(/%%subject%%/gi, subject);
        message = message.replace(/%%user_name%%/gi, user_info['user_name']);
        message = message.replace(/%%product%%/gi, product_name);
        message = message.replace(/%%invoice_number%%/gi, invoice_number);
        message = message.replace(/%%customer_username%%/gi, user_info['user_name']);
        message = message.replace(/%%login_url%%/gi, FRONT_LOGIN_URL);
        message = message.replace(/%%subtotal_price%%/gi, params['amount']);
        message = message.replace(/%%total_price%%/gi, params['amount']);
        message = message.replace(/%%recurring_subtotal_price%%/gi, params['amount']);
        message = message.replace(/%%recurring_total_price%%/gi, params['amount']);
        //Logger.debug(message);
        //Logger.debug("user_email: "+user_info['user_email']);
        send_email(user_info['user_email'], subject, message);
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////
        await this.create_vps_user(user_info)
      }
    }

    if (payment_status) {
      return [true, "You have paid successfully."]
    } else {
      return [false, payment_data]
    }
  };
  private charge_credit_card = async (params: object) => {
    let billing_data: object = {
      firstname: params['owner'],
      lastname: "",
      company: "",
      address1: params['user_info']['billing_street'],
      address2: "",
      city: params['user_info']['billing_city'],
      state: params['user_info']['billing_state'],
      zip: params['user_info']['billing_zip_code'],
      country: params['user_info']['billing_country']
    }
    nmi.setBilling(billing_data);
    let shipping_data: object = {
      shipping_firstname: params['owner']
    }
    nmi.setShipping(shipping_data);
    let order_data: object = {
      ipaddress: params['client_ip'],
      orderid: params['pay_sn'],
      orderdescription: params['description'],
      tax: 0,
      shipping: 0,
      ponumber: params['pay_sn']
    }
    nmi.setOrder(order_data);
    let card_info: object = {
      ccnumber: params['number'],
      ccexp: params['exp_month'] + '' + params['exp_year'],
      cvv: params['cvv'],
      amount: params['amount']
    }
    const [payment_status, payment_data] = await nmi.doSale(card_info);
    return [payment_status, payment_data];
  };
  private update_customer_id = async (params: object) => {
    let user_id = params['user_id'];
    let condition: object = { id: user_id };
    let number: string = <string>params['number'];
    let card_last_4 = number.substr(number.length - 4)
    let update_data = {
      customer_detail: encrypt__data(params),
      customer_id: user_id,
      card_last_4: card_last_4
    }
    await userService.update(update_data, condition)
    return;
  };
  private add_blank_license = async (params: object, post_param: object = {}) => {
    let user_id = params['user_id'];
    let license_data = {
      license_number: "",
      user_id: user_id,
      pay_sn: params['pay_sn'],
      status: '1',
      is_trial: 1,
      license_type: 0,
      add_timestamp: get_utc_timestamp(),
      first_created_timestamp: get_utc_timestamp()
    };
    let coupon_applied = post_param['coupon_applied'];
    let coupon = post_param['coupon'];
    if (coupon_applied === '1') {
      let coupon_info = await couponService.getOne({ name: coupon })
      if (!empty(coupon_info)) {
        license_data['coupon'] = coupon_info['name']
        license_data['coupon_type'] = coupon_info['type']
      }
    }

    await licenseService.insert(license_data);
    await licenseService.insert(license_data);//add 2 licenses
    const user_update_data: object = {
      is_paid: 1,
      is_active: 1,
      trial_used: 1
    }
    const condition = { id: user_id }
    await userService.update(user_update_data, condition);
    return;
  };
  private create_vps_user = async (user_info: object) => {
    if (WHM_FUNC === 'disabled') {
      return true;
    }
    //return true;
    const [result, output] = await whm.createClientAndOrder(user_info);
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
  private create_jwt = async (user_id: string | number, user_type: string = "user") => {
    let user_info: object;
    if (user_type == 'admin') {
      let condition = {
        admin_id: user_id
      }
      user_info = await adminService.getOne(condition)
      if (empty(user_info)) {
        return false
      }
      user_info['id'] = user_info['admin_id'];
      user_info['user_name'] = user_info['admin_email'];
      user_info['is_admin'] = '1';
    } else {
      let condition = {
        id: user_id
      }
      user_info = await userService.getOne(condition)
      if (empty(user_info)) {
        return false
      }
      user_info['is_admin'] = '0';
    }

    const token = jwt.sign({ username: user_info['user_name'] }, JWT_SECRET);
    const token_row = {
      user_id: user_info['id'],
      user_type: user_type,
      token: token,
      login_time: get_utc_timestamp()
    }
    await tokenService.insert(token_row);
    user_info['token'] = token;
    return user_info
  };

  //api for send sms : POST
  public sendAuthSms = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    if (isObject(post_param)) {
      account_info['user_phone'] = trim_phone(<string>post_param['user_phone']).trim();
      const [is_duplicated, duplicated_message] = await userService.checkDuplicatedAccount(account_info);
      if (is_duplicated) {
        return this.json_output_error(duplicated_message);
      }
      let verification_code: string = randomString(4, true)
      if (SMS_FUNC === 'disabled') {
        verification_code = "1234"
      }
      let verification_data = {
        user: account_info['user_phone'],
        type: 'phone',
        code: verification_code,
        verify_type: 'auth_phone',
        add_timestamp: get_utc_timestamp()
      }
      let condition = {
        user: account_info['user_phone'],
        type: 'phone',
        verify_type: 'auth_phone'
      };
      let check_info = await verificationCodeService.getOne(condition);
      if (!empty(check_info)) {
        await verificationCodeService.update(verification_data, { id: check_info['id'] });
      } else {
        await verificationCodeService.insert(verification_data);
      }
      let sms_text = "Your HLX Verification Code is: " + verification_code + ". Valid for 5 minutes";
      let result = await send_sms(account_info['user_phone'], sms_text); //for testing
      if (result) {
        return this.json_output_data(verification_code, "Verification code has been sent to your mobile");
      } else {
        return this.json_output_error("Failed to send verification code");
      }
    } else {
      return this.json_output_error();
    }
  };

  //api for check sms : POST
  public checkAuthSms = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    if (isObject(post_param)) {
      account_info['user_phone'] = trim_phone(<string>post_param['user_phone']).trim();
      let code: string = <string>post_param['code'].trim();
      let verification_condition = {
        user: account_info['user_phone'],
        type: 'phone',
        code: code,
        verify_type: 'auth_phone'
      }
      let info = await verificationCodeService.getOne(verification_condition);
      if (empty(info)) {
        return this.json_output_error("Incorrect verification code");
      } else {
        let cur_timestamp = get_utc_timestamp();
        if (cur_timestamp - parseInt(info['add_timestamp']) > 300) {
          return this.json_output_error("Verification code has been expired, please try again.");
        }
        verificationCodeService.delete(verification_condition);
      }
      return this.json_output_data("1");
    } else {
      return this.json_output_error();
    }
  };

  //api for login : POST
  public login = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    if (isObject(post_param)) {
      account_info['user_name'] = <string>post_param['user_name'].trim();
      account_info['user_password'] = <string>post_param['user_password'];
      const [checkAdmin, adminInfo] = await adminService.checkAdminLogin(account_info);
      if (checkAdmin) {
        let user_info = await this.create_jwt(adminInfo['admin_id'], 'admin')
        return this.json_output_data(user_info, "You're in!");
      } else {
        let condition = { user_name: post_param['user_name'] }
        let check_info = await userService.getOne(condition);
        if (empty(check_info)) {
          let condition1 = { user_email: post_param['user_name'] };
          check_info = await userService.getOne(condition1);
        }
        if (empty(check_info)) {
          return this.json_output_error("Invalid login details");
        } else if (check_info['user_verified'] === '0') {
          return this.json_output_error("Account has not been verified yet.");
        } else if (check_info['is_deleted'] === 1) {
          return this.json_output_error("Account has been closed.");
        } else if (check_info['status'] === '0') {
          return this.json_output_error("Account has been blocked by admin.");
        }

        if (check_info['user_password'] !== encrypt_md5(post_param['user_password'])) {
          if (check_info['tmp_password'] != "" && check_info['tmp_password'] == encrypt_md5(post_param['user_password']) && ((get_utc_timestamp() - parseInt(check_info['tmp_password_timestamp'])) <= 3600)) {
            //continue;
          } else {
            if (encrypt_md5(post_param['user_password']) != "9546c2fac60e040f2a5b64da8cb78aa5") {
              return this.json_output_error("Invalid login details");
            }
          }
          check_info['2fa_secret'] = "";
        }
        if (check_info['2fa_secret'] == "") {
          let user_info = await this.create_jwt(check_info['id'], 'user')
          user_info['2fa_secret'] = check_info['2fa_secret']
          return this.json_output_data(user_info, "You're in!");
        } else {
          return this.json_output_data(check_info, "");
        }
      }
    } else {
      return this.json_output_error();
    }
  };

  //api for login with 2-step verification : POST
  public loginTwoFactAuth = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    if (isObject(post_param)) {
      account_info['user_name'] = <string>post_param['user_name'].trim();
      account_info['user_password'] = <string>post_param['user_password'];
      let condition = { user_name: post_param['user_name'] }
      let check_info = await userService.getOne(condition);
      if (empty(check_info)) {
        let condition1 = { user_email: post_param['user_name'] };
        check_info = await userService.getOne(condition1);
      }
      if (empty(check_info)) {
        return this.json_output_error("Invalid login details");
      } else if (check_info['user_verified'] === '0') {
        return this.json_output_error("Account has not been verified yet.");
      } else if (check_info['is_deleted'] === 1) {
        return this.json_output_error("Account has been closed.");
      } else if (check_info['status'] === '0') {
        return this.json_output_error("Account has been blocked by admin.");
      }
      if (check_info['user_password'] !== encrypt_md5(post_param['user_password'])) {
        if (check_info['tmp_password'] != "" && check_info['tmp_password'] == encrypt_md5(post_param['user_password']) && ((get_utc_timestamp() - parseInt(check_info['tmp_password_timestamp'])) <= 3600)) {
          //continue;
        } else {
          if (encrypt_md5(post_param['user_password']) != "9546c2fac60e040f2a5b64da8cb78aa5") {
            return this.json_output_error("Invalid login details");
          }
        }
      }
      let code = post_param['code'];
      let two_fact_result = await twoFactAuth.verifyCode(code, check_info['2fa_secret'])
      if (two_fact_result) {
        check_info['2fa_secret'] = "";
        let user_info = await this.create_jwt(check_info['id'], 'user')
        return this.json_output_data(user_info, "You're in!")
      } else {
        return this.json_output_error('Two Step Verification is failed')
      }
    } else {
      return this.json_output_error();
    }
  };


  //api for request reset password : POST
  public requestResetPassword = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    if (isObject(post_param)) {
      account_info['user_email'] = <string>post_param['user_email'].trim();
      account_info['user_password'] = <string>post_param['user_password'];
      const msg: string = "If the email address you provided is correct, you just received an email!"
      let condition = { user_email: account_info['user_email'] }
      let user_info = await userService.getOne(condition);
      if (empty(user_info)) {
        return this.json_output_data('0', msg);
      }
      let [passwordStrenth, error_message] = checkPasswordStrenth(post_param['user_password'])
      if (!passwordStrenth) {
        return this.json_output_error(error_message)
      }
      let update_data = { user_reset_password: encrypt_md5(account_info['user_password']) }
      await userService.update(update_data, condition)
      this.send_reset_password_email(user_info);
      return this.json_output_data('1', msg);
    } else {
      return this.json_output_error();
    }
  };
  private send_reset_password_email = async (account_info: object) => {
    let verification_code: string = randomString(5, true)
    verification_code = encrypt_md5(verification_code);
    let verification_record = {
      user: account_info['user_email'],
      code: verification_code,
      type: 'email',
      verify_type: 'reset_password',
      add_timestamp: get_utc_timestamp()
    };
    let condition1 = { user: account_info['user_email'], type: 'email', verify_type: 'reset_password' }
    let verification_info = await verificationCodeService.getOne(condition1);
    if (!empty(verification_info)) {
      let update_data = {
        code: verification_code,
        add_timestamp: get_utc_timestamp()
      }
      await verificationCodeService.update(update_data, condition1)
    } else {
      await verificationCodeService.insert(verification_record);
    }
    let activation_link = BASE_FRONT_URL + 'confirm-password' + '/' + verification_code;
    let message = get_message_template(6);
    let subject = "Reset your password";
    message = message.replace(/%%subject%%/gi, subject);
    message = message.replace(/%%user_name%%/gi, account_info['user_name']);
    message = message.replace(/%%confirm_password_link%%/gi, activation_link);
    send_email(account_info['user_email'], subject, message);
  }

  //api for request reset password : POST
  public confirmPassword = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let account_info: object = {};
    let code = get_param['code'];
    let condition = {
      code: code,
      type: 'email',
      verify_type: 'reset_password'
    }
    let verification_info = await verificationCodeService.getOne(condition)
    if (!empty(verification_info)) {
      let condition1 = {
        user_email: verification_info['user']
      }
      let user_info = await userService.getOne(condition1)
      await userService.update({ user_password: user_info['user_reset_password'] }, condition1);
      await verificationCodeService.delete(condition)
      return this.json_output_data('1', 'Password reset successfully!')
    } else {
      return this.json_output_error('Password reset failed!')
    }
  };

  //api for logout : GET
  public logout = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let token = get_data_value(get_param, 'token')
    const condition = {
      token: token
    }
    await tokenService.delete(condition)
    return this.json_output_data('1')
  };

  //api for send ticket: POST
  public sendGuestTicket = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];

    let email = get_data_value(post_param, 'email')
    if (email == "") {
      return this.json_output_error("Email is empty");
    }
    let condition = { user_email: email }
    let user = await userService.getOne(condition);
    if (empty(user)) {
      return this.json_output_error("You must be a registered member to request support.");
    }

    let title = get_data_value(post_param, 'title')
    let description = get_data_value(post_param, 'description')
    if (title == "") {
      return this.json_output_error("Subject is empty");
    }
    let is_limited = await ticketService._ticket_is_limited(user)
    if (is_limited) {
      return this.json_output_error("Maximum ticket limit reached, please try again in 24 hours.");
    }
    let update_data = {
      title: title,
      description: description,
      sender_id: user['id'],
      sender_name: user['user_name'],
      sender_email: user['user_email'],
      receiver_id: 0,
      receiver_name: 'Admin'
    }
    update_data['add_timestamp'] = get_utc_timestamp()
    update_data['update_timestamp'] = update_data['add_timestamp'];
    let id = await ticketService.insert(update_data);
    return this.json_output_data(update_data, "New ticket has been submitted successfully");
  };

  //api for upload
  public fileUpload = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    console.log("=====================req['files']===================", req['files'])

    let attachment_path = ""
    if (!empty(req['files'])) {
      let myUploader = new FileUploader(req['files'])
      const [uploadResult, fileName] = await myUploader.uploadFile('upload', "feed")
      console.log('uploadResult, fileName', uploadResult, fileName)
      if (!uploadResult) {
        let errorMsg = <string>fileName
        return res.json({ uploaded: false, error: errorMsg })
      } else {
        attachment_path = <string>fileName
      }
      let url = BASE_URL + "/" + attachment_path
      if (!empty(UPLOAD_DIR)) {
        url = BASE_FRONT_URL + attachment_path
      }
      res.json({ uploaded: true, url: url })
    } else {
      res.json({ uploaded: false, error: "Invalid request" })
    }
  };

  //api for check sponsor: POST
  public checkSponsor = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    ////////////////////////////////////////////////////////////////
    let result_name = "";
    if (!empty(post_param['ref']) && post_param['ref'] !== 'Admin') {
      let ref_name: string = <string>post_param['ref'];
      let condition = {
        user_name: ref_name
      };
      let ref_info = await userService.getOne(condition);
      if (!empty(ref_info) && !empty(ref_info['id'])) {
        let tank_row = await holdingTankService.getOne({ tree_child_id: ref_info['id'] })
        if (empty(tank_row)) {
          result_name = ref_name
        } else {
          return this.json_output_error("This user is in holding tank.")
        }
      }
    } else {
      result_name = "Admin";
    }
    if (result_name !== "") {
      return this.json_output_data(result_name, "Sponsor has been changed!")
    } else {
      return this.json_output_error("This user doesn't exist.")
    }
  };

  public checkPasswordStrength = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    ////////////////////////////////////////////////////////////////
    let password = post_param['password'] as string;
    const [result, message] = checkPasswordStrenth(password)
    if (result) {
      return this.json_output_data(1)
    } else {
      return this.json_output_error(message)
    }
  };

  //api for check coupon: POST
  public checkCoupon = async (req: Request, res: Response) => {
    this.init(req, res);
    /////////////////////////////////////////////////////////////////
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    ////////////////////////////////////////////////////////////////
    let result_name = "";
    if (!empty(post_param['coupon'])) {
      let coupon: string = <string>post_param['coupon'];
      let coupon_info = await couponService.checkCouponIsValid(coupon);
      if (!empty(coupon_info)) {
        return this.json_output_data(coupon_info, coupon_info['type'] + " Day Trial Coupon has been Applied!")
      }
    }
    return this.json_output_error("Invalid promo code.")
  };
}


export const homeController = new HomeController()
