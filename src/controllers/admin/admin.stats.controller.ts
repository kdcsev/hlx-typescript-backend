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
import { TB_FEED, TB_HOLD_TANK, TB_LICENSE, TB_TICKET, TB_TRANSACTION, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, LICENSE_PRICE, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import AdminBaseController from './admin.base.controller';
import { Logger } from '../../library/logger';
import { ticketMessageService } from '../../services/ticket.message.service';
import { ticketService } from '../../services/ticket.service';
import FileUploader from '../../library/fileuploader';
import { feedService } from '../../services/feed.service';

export default class AdminStatsController extends AdminBaseController {
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
    let sql = "select sum(balance) as company_balance from " + TB_USER + " where 1=1";

    let exclued_email_list = [
      'alistair.nex1@gmail.com',
      'aricmussman@gmail.com',
      'jenniferbaker97531@gmail.com',
      'jdjamzee@gmail.com',
      'quanseng632@gmail.com',
      'Joshmussman@gmail.com',
      'vipulpatel.vip@me.com',
      'stephanie@garvey.group',
      'jbear0901@yahoo.com'
    ]
    let exclued_emails = []
    for (let key in exclued_email_list) {
      let email = exclued_email_list[key]

      email = mysql.escape(email);
      exclued_emails.push(email)
    }
    if (exclued_emails.length > 0) {
      let exclued_emails_str = exclued_emails.join(',')
      sql += " and (user_email not in (" + exclued_emails_str + ")" + ")";
    }

    let row_list = await userService.query(sql)
    let row = row_list[0];
    let company_balance = get_data_value(row, 'company_balance');
    data['company_balance'] = company_balance;

    let member_stats = await this.get_member_stats();
    data['member_stats'] = member_stats;

    let total_revenue = (member_stats['active_customer_cnt'] * LICENSE_PRICE) + (member_stats['active_affiliate_only_cnt'] * AFFILIATE_COMMISSION) + (member_stats['both_cnt'] * (LICENSE_PRICE + AFFILIATE_COMMISSION)) - (member_stats['free_member_cnt'] * LICENSE_PRICE);
    data['total_revenue'] = total_revenue;
    return this.json_output_data(data);
  }

  private get_member_stats = async () => {
    let sql = "select a.id from " + TB_USER + " as a join " + TB_LICENSE + " as b on a.id = b.user_id where 1=1";
    sql += " and a.is_active = 1 and a.user_type = 0";
    sql += " group by a.id";
    let row_list = <RowDataPacket[]>await userService.query(sql)
    let active_customer_cnt = row_list.length;

    sql = "select a.id from " + TB_USER + " as a where 1=1";
    sql += " and a.is_active = 1 and a.user_type = 1";
    sql += " group by a.id";
    let row_list1 = <RowDataPacket[]>await userService.query(sql)
    let active_affiliate_cnt = row_list1.length;

    sql = "select a.id from " + TB_USER + " as a join " + TB_LICENSE + " as b on a.id = b.user_id where b.license_type = 0 and b.status = '1'";
    sql += " and a.is_active = 1 and a.user_type = 1";
    sql += " group by a.id";
    let row_list2 = <RowDataPacket[]>await userService.query(sql)
    let both_cnt = row_list2.length

    let active_affiliate_only_cnt = active_affiliate_cnt - both_cnt;
    let total_users = active_customer_cnt + active_affiliate_only_cnt + both_cnt;

    sql = "select a.id from " + TB_USER + " as a where a.license_status = 2"; //free license status
    sql += " and a.is_active = 1 and a.user_type = 0";
    sql += " group by a.id";
    let row_list3 = <RowDataPacket[]>await userService.query(sql)
    let free_member_cnt = row_list3.length

    sql = "select a.id from " + TB_USER + " as a join " + TB_LICENSE + " as b on a.id = b.user_id where b.status = '1' and b.is_cancelled = 1";
    sql += " and a.is_active = 1 and a.user_type = 1";
    sql += " group by a.id";
    let row_list4 = <RowDataPacket[]>await userService.query(sql)
    let cancelled_affiliate_cnt = row_list4.length

    sql = "select a.id from " + TB_USER + " as a join " + TB_LICENSE + " as b on a.id = b.user_id where b.status = '1' and b.is_cancelled = 1";
    sql += " and a.is_active = 1 and a.user_type = 0";
    sql += " group by a.id";
    let row_list5 = <RowDataPacket[]>await userService.query(sql)
    let cancelled_customer_cnt = row_list5.length

    let member_stats = {
      active_customer_cnt: active_customer_cnt,
      active_affiliate_only_cnt: active_affiliate_only_cnt,
      both_cnt: both_cnt,
      total_users: total_users,
      free_member_cnt: free_member_cnt,
      cancelled_affiliate_cnt: cancelled_affiliate_cnt,
      cancelled_customer_cnt: cancelled_customer_cnt
    }
    return member_stats;
  }





}

export const adminStatsController = new AdminStatsController()
