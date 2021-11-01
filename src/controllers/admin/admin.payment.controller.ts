import { Request, Response } from 'express'
import * as mysql from 'mysql2';
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_data_value, get_utc_timestamp, intval, in_array, isset, is_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_HOLD_TANK, TB_LICENSE, TB_TRANSACTION, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import AdminBaseController from './admin.base.controller';
import { Logger } from '../../library/logger';

export default class AdminPaymentController extends AdminBaseController {
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
    sql = "select a.*, u.user_name, u.user_email from "+TB_TRANSACTION+" as a left outer join "+ TB_USER+" as u on a.user_id = u.id where a.admin_deleted = '0'";
   
    if (isset(get_param['keyword1']) && !empty(get_param['keyword1'])) {
      let keyword1 = "%" + get_param['keyword1'] + "%";
      keyword1 = mysql.escape(keyword1);
      sql += " and (u.user_name like "+keyword1+" or u.user_email like "+keyword1+" or a.trans_id like "+keyword1+")";
    }
    

    //console.log('==================sql================', sql);
    if (isset(get_param['sort_column'])) {
      let sort_direction = get_data_value(get_param, 'sort_direction', 'asc')
      sql += " order by " + get_param['sort_column'] + " " + sort_direction
    }

    let rows = await licenseService.query(sql) as []
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

  public deleteItem = async (req: Request, res: Response) => { //api for datatable
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = get_data_value(post_param, 'id')
    let condition = {id: id}
    let update_data = {admin_deleted: '1'}
    transactionService.update(update_data, condition);
    return this.json_output_data('1', 'Payment record has been deleted successfully.') 
  }
 



}

export const adminPaymentController = new AdminPaymentController()
