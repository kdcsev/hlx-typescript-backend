import { Request, Response } from 'express'
import { BASE_FRONT_URL, FRONT_LOGIN_URL, WHM_FUNC } from '../../var/env.config';
import { copy_object, decrypt__data, empty, encrypt_md5, encrypt__data, get_data_value, get_message_template, get_utc_timestamp, intval, isset, makePaySn, send_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { AFFILIATE_COMMISSION, LICENSE_PRICE, LICENSE_TRIAL_PRICE } from '../../var/config';
import { Logger } from '../../library/logger';
import { transactionService } from '../../services/transaction.service';
import { treeService } from '../../services/tree.service';
import { nmi } from '../../library/nmi';
import { referralFundsTankService } from '../../services/referral.funds.tank.service';

export default class UserPayController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getPageDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = { user_id: data['user']['id'], status: '1' }
    let license_list = await licenseService.getAll(condition, 'id asc');
    if (empty(license_list)) license_list = <RowDataPacket>[];

    let enabled_membership = 1;
    let is_active_customer = 1;
    if (empty(license_list)) {
      enabled_membership = 0;
      is_active_customer = 0;
    } else {
      let license_info = license_list[0];
      if (intval(license_info['is_cancelled']) === 1) {
        enabled_membership = 0;
      }
    }
    data['enabled_membership'] = enabled_membership;
    data['is_active_customer'] = is_active_customer;
    let customer_payinfo = this.get_nmi_customer(user)
    if (!empty(customer_payinfo)) {
      let card_number = customer_payinfo['number']
      let last4 = card_number.substr(card_number.length - 4);
      data['card_number_last4'] = last4
    } else {
      data['card_number_last4'] = ""
    }

    return this.json_output_data(data);
  }
  private get_nmi_customer = (user_info: object) => {
    let customer_payinfo = !empty(user_info['customer_detail']) ? decrypt__data(user_info['customer_detail']) : false;
    if(!empty(customer_payinfo)) {
      customer_payinfo['cvv'] = get_data_value(customer_payinfo, 'cvc'); 
    }
    return customer_payinfo;
  }
  public payLicense = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let payment_type = get_data_value(post_param, 'payment_type')
    if (payment_type === 'recursive') {
      let customer_payinfo = this.get_nmi_customer(user)
      if (empty(customer_payinfo)) {
        return this.json_output_error("Invalid payment request")
      }
      customer_payinfo['trans_id'] = ""
      customer_payinfo['paid_amount'] = ""
      customer_payinfo['environment'] = ""
      customer_payinfo['payment_type'] = payment_type
      customer_payinfo['card_number'] = customer_payinfo['number'];
      post_param = copy_object(customer_payinfo)
    }
    const [pay_result, payment_data] = await this.pay_with_customer(user['id'], post_param);
    if (pay_result) {
      data['payment_data'] = payment_data
      return this.json_output_data(data);
    } else {
      let error_msg = <string>payment_data
      return this.json_output_error(error_msg)
    }
  }
  public payAffiliate = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let payment_type = get_data_value(post_param, 'payment_type')
    if (payment_type === 'recursive') {
      let customer_payinfo = this.get_nmi_customer(user)
      if (empty(customer_payinfo)) {
        return this.json_output_error("Invalid payment request")
      }
      customer_payinfo['trans_id'] = ""
      customer_payinfo['paid_amount'] = ""
      customer_payinfo['environment'] = ""
      customer_payinfo['payment_type'] = payment_type
      customer_payinfo['card_number'] = customer_payinfo['number'];
      post_param = copy_object(customer_payinfo)
    }
    const [pay_result, payment_data] = await this.pay_with_affiliate(user['id'], post_param);
    if (pay_result) {
      data['payment_data'] = payment_data
      return this.json_output_data(data);
    } else {
      let error_msg = <string>payment_data
      return this.json_output_error(error_msg)
    }
  }
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
    params['is_trial'] = 0;
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
    if (user_info['trial_used'] === 1) {
      params['amount'] = LICENSE_PRICE;
      params['is_trial'] = 0;
    } else {
      params['amount'] = LICENSE_TRIAL_PRICE;
      params['is_trial'] = 1;
    }

    params['client_ip'] = this.get_ip();
    params['user_id'] = user_id;
    params['user_info'] = user_info;
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
      await this.update_customer_id(params)
      await this.update_license_status(params)
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
  private update_license_status = async (params: object) => {
    let data = this.data;
    let user = data['user'];
    let user_id = user['id'];
    let condition = { user_id: user_id }
    let current_license_list = await licenseService.getAll(condition);
    if (!empty(current_license_list)) {
      await licenseService.delete(condition);
    }
    let license_data = {
      license_number: '',
      user_id: user_id,
      pay_sn: params['pay_sn'],
      status: '1',
      is_trial: params['is_trial'],
      license_type: 0,
      add_timestamp: get_utc_timestamp(),
      first_created_timestamp: get_utc_timestamp()
    }
    await licenseService.insert(license_data);
    await licenseService.insert(license_data);//add 2 licenses

    if (params['is_trial'] === 0) {
      await referralFundsTankService.addReferralTank(user_id);
    }
    const user_update_data: object = {
      is_paid: 1,
      is_active: 1,
      trial_used: 1
    }
    const where = { id: user_id }
    await userService.update(user_update_data, where);
    await this._update_vps('active');
    return;
  }
  private _update_vps = async (status: string = 'active') => { //status: active, inactive
    if (WHM_FUNC === 'disabled') {
      return true
    }
    //return true
    let data = this.data;
    let user_info = data['user'];
    let user_email = user_info['user_email'];
    if (status === 'active') {
      let client_info = await whm.checkClientExist(user_email);
      if (empty(client_info)) {
        const [result, output] = await whm.createClientAndOrder(user_info);
      }
      const [result, output] = await whm.moduleCreate(user_email);
      if (result) {
        let condition = {
          id: user_info['id']
        }
        let update_data = {
          vps_status: 1,
          vps_updated_timestamp: get_utc_timestamp()
        }
        await userService.update(update_data, condition)
      }
    } else {
      //list($result, $output) = $this->whm->moduleTerminate($user_email);
    }
    return;
  }






}

export const userPayController = new UserPayController()
