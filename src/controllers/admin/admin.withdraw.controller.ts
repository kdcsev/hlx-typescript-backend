import { Request, Response } from 'express'
import * as mysql from 'mysql2';
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_data_value, get_message_template, get_utc_timestamp, intval, in_array, isset, is_email, send_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_HOLD_TANK, TB_LICENSE, TB_TRANSACTION, TB_USER, TB_WITHDRAW_TRANSACTION } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import AdminBaseController from './admin.base.controller';
import { Logger } from '../../library/logger';

export default class AdminWithdrawController extends AdminBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getDataList = async (req: Request, res: Response) => { //api for datatable
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let per_page = intval(get_data_value(get_param, 'per_page', 10))
    let sql = ""
    sql = "select a.*, u.user_name, u.user_email from " + TB_WITHDRAW_TRANSACTION + " as a left outer join " + TB_USER + " as u on a.user_id = u.id where a.admin_deleted = '0'";

    if (isset(get_param['keyword1']) && !empty(get_param['keyword1'])) {
      let keyword1 = "%" + get_param['keyword1'] + "%";
      keyword1 = mysql.escape(keyword1);
      sql += " and (u.user_name like " + keyword1 + " or u.user_email like " + keyword1 + " or a.paypal_address like " + keyword1 + ")";
    }
    let withdraw_kind = get_data_value(get_param, 'withdraw_kind')
    if (withdraw_kind === 'requested') {
      sql += " and a.status = 0";
    } else if (withdraw_kind === 'pending') {
      sql += " and a.status = 1";
    } else if (withdraw_kind === 'rejected') {
      sql += " and a.status = 2";
    } else if (withdraw_kind === 'completed') {
      sql += " and (a.status = 3 or a.status = 1)";
    }

    //console.log('==================sql================', sql);
    if (isset(get_param['sort_column'])) {
      let sort_direction = get_data_value(get_param, 'sort_direction', 'asc')
      sql += " order by " + get_param['sort_column'] + " " + sort_direction
    }

    let rows = await withdrawTransactionService.query(sql) as []
    let total = rows.length;

    let page = intval(get_data_value(get_param, 'page', 1))

    let offset = (page - 1) * per_page;
    sql += " limit " + offset + "," + per_page;
    let list = <RowDataPacket[]>await userService.query(sql)
    if (empty(list)) list = []

    data['page'] = page;
    data['per_page'] = per_page;
    data['total'] = total;

    let total_pages = 0
    if (total > 0) {
      total_pages = Math.ceil(total / per_page)
    }
    data['total_pages'] = total;
    data['data'] = list;

    return res.json(data)
  }

  public changeStatus = async (req: Request, res: Response) => { //api for datatable
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = post_param['id']
    let condition = {id: id}
    let withdraw_info = await withdrawTransactionService.getOne(condition);
    let success_message = 'Withdraw request has been approved';
    if(!empty(withdraw_info)){
      let action = get_data_value(post_param, 'action')
      if(action === 'update'){
        let status = post_param['status']
        let update_data = {status: status}
        if(status == '1'){
          update_data['processing_time'] = get_utc_timestamp();
          success_message = 'Withdraw request has been approved';
          await withdrawTransactionService.update(update_data, condition);
          let receiver_info = await userService.getOne({id: withdraw_info['user_id']});
          if(!empty(receiver_info)){
              let subject = "Withdrawal Approved!";
              let message = get_message_template(11);
              message = message.replace(/%%user_name%%/gi, receiver_info['user_name']);
              message = message.replace(/%%withdraw_amount%%/gi, withdraw_info['amount']);
              send_email(receiver_info['user_email'], subject, message);
          }
        }else if(status == '2'){ //when reject, increase balance of user
          success_message = 'Withdraw request has been rejected';
          if(intval(withdraw_info['status'])===0){
              await this.repair_user_balance(withdraw_info);
              await withdrawTransactionService.update(update_data, condition);
          }
        } 
      }else if(action === 'delete'){
        let update_data = {admin_deleted: '1'}
        await withdrawTransactionService.update(update_data, condition);
        success_message = 'Withdraw transaction record has been deleted successfully.'
      }
      return this.json_output_data('1', success_message);
    }else{
        return this.json_output_error('Invalid request');
    }
  }
  private repair_user_balance = async (withdraw_info:object)=>{
    let user_condition = {id: withdraw_info['user_id']}
    let user_info = await userService.getOne(user_condition);
    if(!empty(user_info)){
        let balance = floatval(user_info['balance']);
        balance+=floatval(withdraw_info['amount']);
        let update_data = { balance: balance}
        await userService.update(update_data, {id: user_info['id']});
    }
    return true
}




}

export const adminWithdrawController = new AdminWithdrawController()
