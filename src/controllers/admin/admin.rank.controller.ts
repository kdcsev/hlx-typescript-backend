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

export default class AdminRankController extends AdminBaseController {
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
    let [affiliate_stats, rank_finance] = await this.get_affiliate_stats();
    data['affiliate_stats'] = affiliate_stats;
    data['rank_finance'] = rank_finance;
    return this.json_output_data(data);
  }

  private get_affiliate_stats = async () => {
    let sql = "";
    let rank_rules = await rankRuleService.getAll();
    let rank_rule_list = array_under_reset(rank_rules, 'rank_no');
    sql = "select a.id, a.user_name, a.rank_no, a.rank_name from " + TB_USER + " as a where 1=1";
    sql += " and a.is_active = 1 and a.user_type = 1 and rank_name <> ''";
    sql += " order by a.rank_no desc";
    let row_list = <RowDataPacket[]>await userService.query(sql)
    let affiliate_stats = []
    let rank_finance = 0;
    if(!empty(row_list)){
      let affiiate_list = array_under_reset(row_list, 'rank_no', 2)
      for(let key in affiiate_list) {
        let user_list = affiiate_list[key];
        if(!empty(user_list)){
          let copy_user_list = copy_object(user_list)
          let affiliate_stats_item = {
            rank_no: copy_user_list[0]['rank_no'],
            rank_name: copy_user_list[0]['rank_name'],
            count: copy_user_list.length,
            user_list: copy_user_list
          }
          if(isset(rank_rule_list[affiliate_stats_item['rank_no']])){
            let weekly_residuals = floatval(rank_rule_list[affiliate_stats_item['rank_no']]['weekly_residuals'])
            rank_finance += weekly_residuals * affiliate_stats_item['count']
          }
          affiliate_stats = [affiliate_stats_item, ...affiliate_stats]
        }
      }
    }
    return [affiliate_stats, rank_finance]
  }





}

export const adminRankController = new AdminRankController()
