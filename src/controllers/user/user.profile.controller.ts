import { Request, Response } from 'express'
import { BASE_FRONT_URL, WHM_FUNC } from '../../var/env.config';
import { array_merge, array_under_reset, checkPasswordStrenth, copy_object, decrypt__data, empty, encrypt_md5, encrypt__data, floatval, get_data_value, get_message_template, get_utc_timestamp, intval, in_array, isset, is_email, send_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import { referralFundsTankService } from '../../services/referral.funds.tank.service';
import { Logger } from '../../library/logger';

export default class UserProfileController extends UserBaseController {
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
    return this.json_output_data(data);
  }
  public updateDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let account_info = {
      id: user['id'],
      user_email: post_param['user_email'].trim(),
      user_first_name: post_param['user_first_name'].trim(),
      user_last_name: post_param['user_last_name'].trim()
    }

    if (empty(account_info['user_email'])) {
      return this.json_output_error("Email is empty")
    }
    if (!is_email(account_info['user_email'])) {
      return this.json_output_error("Invalid email format")
    }

    if (empty(account_info['user_first_name'])) {
      return this.json_output_error("First name is empty")
    }
    if (empty(account_info['user_last_name'])) {
      return this.json_output_error("Last name is empty")
    }

    const [is_duplicated, message] = await userService.checkDuplicatedAccount(account_info);
    if (is_duplicated) {
      return this.json_output_error(message)
    }

    if (post_param['user_password'] !== "") {
      let [passwordStrenth, error_message] = checkPasswordStrenth(post_param['user_password'])
      if (!passwordStrenth) {
        return this.json_output_error(error_message)
      }
      account_info['user_password'] = encrypt_md5(post_param['user_password']);
    }
    let updateWhmResult = await this._update_WHM_user_info(data['user'], account_info);
    if (!updateWhmResult) {
      return false;
    }

    Logger.info('User updated profile: old_info: ' + (data['user']['user_name']));
    let condition = { id: user['id'] }
    await userService.update(account_info, condition);

    let condition1 = { id: user['id'] }
    let user_info = await userService.getOne(condition1)
    data['user'] = user_info
    return this.json_output_data(data);
  }

  private _update_WHM_user_info = async (user_current_info: object, user_new_info: object) => {
    if (WHM_FUNC === 'disabled') {
      return true
    }
    if (intval(user_current_info['vps_status']) >= 2) {
      return true;
    }
    if (user_current_info['user_email'] === user_new_info['user_email']) {
      return true;
    }

    let user_email = user_current_info['user_email'];
    let vps_order_detail = await whm.getServiceId(user_email);
    let user_id = get_data_value(vps_order_detail['client'], 'userid');
    if (empty(user_id)) {
      this.json_output_error("VPS product can not be found")
      return false;
    }
    let vps_upate_user_data = {
      email: user_new_info['user_email']
    }
    const [result, message] = await whm.updateUser(vps_order_detail, vps_upate_user_data);
    if (!result) {
      this.json_output_error(message)
      return false;
    } else {
      return true;
    }
  }
  public updateCardDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let params = {};
    params['owner'] = post_param['owner'];
    params['cvc'] = post_param['cvv'];
    params['number'] = post_param['card_number'];
    params['exp_month'] = post_param['exp_month'];
    params['exp_year'] = post_param['exp_year'];

    let user_id = user['id'];
    let condition: object = { id: user_id };
    let number: string = <string>params['number'];
    let card_last_4 = number.substr(number.length - 4)
    let customer_detail = user['customer_detail']
    let customer_detail_obj = {}
    if (!empty(customer_detail)) {
      customer_detail_obj = decrypt__data(customer_detail)
    } else {
      customer_detail_obj = {
        payment_type: 'newly',
        owner: '',
        cvc: '',
        number: '',
        exp_month: '',
        exp_year: '',
        pay_sn: '',
        amount: '0',
        client_ip: "",
        description: 'purchase_license',
        user_id: user['id'],
        payment_product: 'purchase_license',
        trans_id: '',
        paid_amount: 0,
        environment: 'live',
      }
    }
    let new_param = { ...customer_detail_obj, ...params }
    let update_data = {
      customer_detail: encrypt__data(new_param),
      customer_id: user_id,
      card_last_4: card_last_4
    }
    console.log("customer_detail_obj", customer_detail_obj)
    console.log("update_data", update_data)
    await userService.update(update_data, condition)
    let user_info = await userService.getOne({ id: user['id'] })
    data['user'] = user_info
    return this.json_output_data(data);
  }
  public removeCardDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let user_id = user['id'];
    let condition: object = { id: user_id };
    let update_data = {
      customer_detail: "",
      customer_id: "",
      card_last_4: ""
    }
    Logger.info("user_id(" + user_id + ") has removed his card");
    await userService.update(update_data, condition)
    let user_info = await userService.getOne({ id: user['id'] })
    data['user'] = user_info
    return this.json_output_data(data);
  }
  public cancelMembership = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = { user_id: user['id'] }
    let update_data = {
      is_cancelled: 1
    }
    await licenseService.update(update_data, condition);
    let subject = "Your cancellation was successful!";
    let message = get_message_template(13);
    message = message.replace(/%%subject%%/gi, subject);
    message = message.replace(/%%user_name%%/gi, user['user_name']);
    send_email(user['user_email'], subject, message);

    let condition1 = { id: user['id'] }
    let user_info = await userService.getOne(condition1)
    data['user'] = user_info
    return this.json_output_data(data);
  }
  public cancelAffiliate = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = { id: user['id'] }
    let update_data = {
      user_type: 0
    }
    await userService.update(update_data, condition);
    let check_user_is_active = await userService.check_user_is_active(user['id'])
    if (!check_user_is_active) {
      //$update_data['is_active'] = 0;
      let active_license = await licenseService.getOne({ user_id: user['id'], status: '1' });//check user has any paid license (with trial)
      if (empty(active_license)) {
        update_data['is_paid'] = 0;
        update_data['is_active'] = 0;
        await userService.update(update_data, condition);
      }
    }
    ///////////////////////////////////////////////////////////////////
    let where = {
      ref_id: user['encrypted_id'],
      is_paid: '1',
      is_active: '1',
      is_deleted: '0'
    }
    let user_list = await userService.getAll(where);
    if (empty(user_list)) {
      user_list = <any>[];
    }
    for (let key in user_list) {
      let user_info = user_list[key]
      let user_id = user_info['id'];
      await referralFundsTankService.addReferralTank(user_id);
    }

    let subject = "Your cancellation was successful!";
    let message = get_message_template(14);
    message = message.replace(/%%subject%%/gi, subject);
    message = message.replace(/%%user_name%%/gi, user['user_name']);
    send_email(user['user_email'], subject, message);

    let condition1 = { id: user['id'] }
    let user_info = await userService.getOne(condition1)
    data['user'] = user_info
    return this.json_output_data(data);
  }




}

export const userProfileController = new UserProfileController()
