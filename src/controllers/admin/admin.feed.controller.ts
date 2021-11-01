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
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import AdminBaseController from './admin.base.controller';
import { Logger } from '../../library/logger';
import { ticketMessageService } from '../../services/ticket.message.service';
import { ticketService } from '../../services/ticket.service';
import FileUploader from '../../library/fileuploader';
import { feedService } from '../../services/feed.service';

export default class AdminFeedController extends AdminBaseController {
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
    sql = "select u.* from " + TB_FEED + " as u where 1=1";
    if (isset(get_param['keyword1']) && !empty(get_param['keyword1'])) {
      let keyword1 = "%" + get_param['keyword1'] + "%";
      keyword1 = mysql.escape(keyword1);
      sql += " and (u.subject like " + keyword1 + " or u.message like " + keyword1 + ")";
    }

    //console.log('==================sql================', sql);
    if (isset(get_param['sort_column'])) {
      let sort_direction = get_data_value(get_param, 'sort_direction', 'asc')
      sql += " order by " + get_param['sort_column'] + " " + sort_direction
    }

    let rows = await feedService.query(sql) as []
    let total = rows.length;

    let page = intval(get_data_value(get_param, 'page', 1))

    let offset = (page - 1) * per_page;
    sql += " limit " + offset + "," + per_page;
    let list = <RowDataPacket[]>await feedService.query(sql)
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
  public getInfoPageDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = get_data_value(get_param, 'feedid')
    let condition = { id: id }
    let info = await feedService.getOne(condition);
    if (empty(info)) info = { subject: "", message: "" }
    data['feed_info'] = info;
    return this.json_output_data(data);
  }
  public submitFeed = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = intval(get_data_value(post_param, 'id'))
    let update_data = {}
    update_data['subject'] = post_param['subject'];
    update_data['message'] = post_param['message'];
    if(id > 0){
      let condition = {id: id}
      await feedService.update(update_data, condition)
      return this.json_output_data(data, "Feed has been updated successfully");
    }else{
      update_data['status'] = '';
      update_data['add_timestamp'] = get_utc_timestamp()
      await feedService.insert(update_data)
      return this.json_output_data(data, "News feed has been submitted successfully");
    }
  }
  public deleteFeed = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = post_param['id']
    let condition = { id: id }
    let info = await feedService.getOne(condition);
    await feedService.delete(condition);
    return this.json_output_data(data, "Feed has been deleted successfully.");
  }




}

export const adminFeedController = new AdminFeedController()
