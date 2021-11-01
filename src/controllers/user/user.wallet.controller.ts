import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_data_value, get_utc_timestamp, intval, in_array, isset, is_email } from '../../helpers/misc';
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
import { MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';

export default class UserWalletController extends UserBaseController {
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
    let condition = { user_id: data['user']['id'], user_deleted: '0' }
    let list = await payoutService.getAll(condition, "id desc")
    if (empty(list)) list = <any>[];
    data['payout_list'] = list;

    let withdraw_list = await withdrawTransactionService.getAll(condition, "id desc")
    if (empty(withdraw_list)) withdraw_list = <any>[];
    for (let key in withdraw_list) {
      let info = withdraw_list[key]
      if (intval(info['status']) === 0) {
        withdraw_list[key]['status_str'] = "Requested";
      } else if (intval(info['status']) === 1) {
        withdraw_list[key]['status_str'] = "Approved";
      } else if (intval(info['status']) === 2) {
        withdraw_list[key]['status_str'] = "Rejected";
      } else if (intval(info['status']) === 3) {
        withdraw_list[key]['status_str'] = "Completed";
      }
    }
    data['withdraw_list'] = withdraw_list;

    return this.json_output_data(data);
  }
  public requestWithdrawal = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let amount = post_param['payout_amount'];
    amount = floatval(amount);
    let balance = floatval(user['balance']);
    if (balance < amount) {
      return this.json_output_error("The requested amount is more than your available funds.");
    }
    if (amount < 50) {
      return this.json_output_error("Minimum withdrawal amount is $50.");
    }
    let paypal_address = get_data_value(post_param, 'paypal_address');
    paypal_address = paypal_address.trim()
    if (paypal_address == '' || !is_email(paypal_address)) {
      return this.json_output_error("Incorrect Paypal address.");
    }
    let trans_info = {
      user_id: data['user']['id'],
      amount: amount,
      method_name: 'paypal',
      paypal_address: paypal_address,
      add_timestamp: get_utc_timestamp(),
      status: 0
    }
    let id = await withdrawTransactionService.insert(trans_info);
    balance = balance - amount;
    let update_data = { balance: balance }
    let where = { id: user['id'] }
    await userService.update(update_data, where);
    return this.json_output_data(data);
  }
  public deletePayout = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = post_param['id'];
    let condition = { user_id: data['user']['id'], id: id }
    let update_data = { user_deleted: '1' }
    await payoutService.update(update_data, condition)

    let condition1 = { user_id: data['user']['id'], user_deleted: '0' }
    let list = await payoutService.getAll(condition1, "id desc")
    if (empty(list)) list = <any>[];
    data['payout_list'] = list;

    return this.json_output_data(data);
  }
  public deleteWithdrawal = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = post_param['id']
    let condition = { user_id: data['user']['id'], id: id }
    let withdraw_info = await withdrawTransactionService.getOne(condition);
    if (!empty(withdraw_info)) {
      if (intval(withdraw_info['status']) === 0) {
        let balance = floatval(data['user']['balance']);
        balance += floatval(withdraw_info['amount']);
        let update_data = { balance: balance }
        await userService.update(update_data, { id: data['user']['id'] })
        await withdrawTransactionService.delete(condition);
      } else {
        let update_data = { user_deleted: '1' }
        await withdrawTransactionService.update(update_data, condition);
      }
    }
    
    let condition1 = { user_id: data['user']['id'], user_deleted: '0' }
    let withdraw_list = await withdrawTransactionService.getAll(condition1, "id desc")
    if (empty(withdraw_list)) withdraw_list = <any>[];
    for (let key in withdraw_list) {
      let info = withdraw_list[key]
      if (intval(info['status']) === 0) {
        withdraw_list[key]['status_str'] = "Requested";
      } else if (intval(info['status']) === 1) {
        withdraw_list[key]['status_str'] = "Approved";
      } else if (intval(info['status']) === 2) {
        withdraw_list[key]['status_str'] = "Rejected";
      } else if (intval(info['status']) === 3) {
        withdraw_list[key]['status_str'] = "Completed";
      }
    }
    data['withdraw_list'] = withdraw_list;
    return this.json_output_data(data);
  }





}

export const userWalletController = new UserWalletController()
