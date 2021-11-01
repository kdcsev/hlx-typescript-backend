import { Request, Response } from 'express'
import * as mysql from 'mysql2';
import * as Excel from 'exceljs-node';
import { BASE_FRONT_URL, WHM_FUNC } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_current_date, get_data_value, get_utc_timestamp, intval, in_array, isset, is_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_HOLD_TANK, TB_LICENSE, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import AdminBaseController from './admin.base.controller';
import { Logger } from '../../library/logger';

export default class AdminUserController extends AdminBaseController {
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
    if (get_param['user_kind'] === 'holding_tank') {
      sql = "select u.* from " + TB_USER + " as u join " + TB_HOLD_TANK + " as h on u.id = h.tree_child_id where u.user_verified = '1'";
    } else {
      if (get_param['user_kind'] === 'both') {
        sql = "select u.* from " + TB_USER + " as u join " + TB_LICENSE + " as b on u.id = b.user_id where b.status = '1' and u.user_verified = '1'";
      } else {
        sql = "select u.* from " + TB_USER + " as u where u.user_verified = '1'";
      }
    }
    sql += " and u.user_type <> 2";

    if (isset(get_param['user_kind'])) {
      if (get_param['user_kind'] === 'affliate') {
        sql += " and u.user_type = 1";
      } else if (get_param['user_kind'] === 'active_customer') {
        sql += " and u.user_type = 0";
        sql += " and u.is_active = 1";
      } else if (get_param['user_kind'] === 'both') {
        sql += " and u.user_type = 1";
      } else if (get_param['user_kind'] === 'inactive_customer') {
        sql += " and u.user_type = 0";
        sql += " and u.is_active = 0";
      } else if (get_param['user_kind'] === 'free_tier') {
        sql += " and u.license_status = 2";
      }
    }

    //$sql.=" and u.is_paid = 1";
    if (isset(get_param['keyword1']) && !empty(get_param['keyword1'])) {
      let keyword1 = "%" + get_param['keyword1'] + "%";
      keyword1 = mysql.escape(keyword1);
      sql += " and (u.user_name like " + keyword1 + " or u.user_email like " + keyword1 + ")";
    }
    sql += " group by u.id";
    //console.log('==================sql================', sql);
    if (isset(get_param['sort_column'])) {
      let sort_direction = get_data_value(get_param, 'sort_direction', 'asc')
      sql += " order by " + get_param['sort_column'] + " " + sort_direction
    }

    let rows = await userService.query(sql) as []
    let total = rows.length;

    let page = intval(get_data_value(get_param, 'page', 1))

    let offset = (page - 1) * per_page;
    sql += " limit " + offset + "," + per_page;
    let list = <RowDataPacket[]>await userService.query(sql)
    if (empty(list)) list = []

    for (let key in list) {
      let item = list[key]
      if (intval(item['user_type']) === 1) {
        // let user_tree_rank = await userService.getUserRank(item['id']);
        // let rank_info = get_data_value(user_tree_rank, 'rank_info')
        // list[key]['rank_info'] = rank_info
        let check_user_has_active_license = await userService.check_user_has_active_license(item['id']);
        list[key]['check_user_has_active_license'] = check_user_has_active_license;
      }
    }

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

  public setTmpPassword = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let user_id = get_data_value(post_param, 'user_id');
    let tmp_password = get_data_value(post_param, 'tmp_password');
    if (tmp_password != "") {
      tmp_password = encrypt_md5(tmp_password);
    }
    let update_data = {
      tmp_password: tmp_password,
      tmp_password_timestamp: get_utc_timestamp()
    }
    let condition = { id: user_id }
    await userService.update(update_data, condition);
    return this.json_output_data(data, 'Temporary password has been set successfully');
  };

  public updateUserInfo = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let user_id = get_data_value(post_param, 'id');
    let condition = { id: user_id }
    let info = await userService.getOne(condition);

    let update_data = {}
    update_data['user_email'] = post_param['user_email']
    if (!is_email(update_data['user_email'])) {
      return this.json_output_error("Invalid email format")
    }
    update_data['user_first_name'] = post_param['user_first_name']
    if (empty(update_data['user_first_name'])) {
      return this.json_output_error("First name is empty")
    }
    update_data['user_last_name'] = post_param['user_last_name']
    if (empty(update_data['user_last_name'])) {
      return this.json_output_error("Last name is empty")
    }

    update_data['balance'] = post_param['balance'];
    if (post_param['user_password'] !== "") {
      update_data['user_password'] = encrypt_md5(post_param['user_password']);
    }
    let user_info = copy_object(update_data)
    user_info['id'] = user_id;
    const [check, msg] = await userService.checkDuplicatedAccount(user_info);
    if (check) {
      return this.json_output_error(msg)
    }
    await this._update_WHM_user_info(info, update_data);

    await userService.update(update_data, condition);
    Logger.info("admin updated user info, old user info: ");
    Logger.info(JSON.stringify(info));

    return this.json_output_data(data, 'User has been updated successfully');
  };

  private _update_WHM_user_info = async (user_current_info: any, user_new_info: any) => {
    if (WHM_FUNC === 'disabled') {
      return true;
    }
    if (intval(user_current_info['vps_status']) >= 2) {
      return false;
    }
    if (user_current_info['user_email'] === user_new_info['user_email']) {
      return false;
    }

    let user_email = user_current_info['user_email'];
    let vps_order_detail = await whm.getServiceId(user_email);
    //print_r($vps_order_detail); die;
    let user_id = get_data_value(vps_order_detail['client'], 'userid');
    //print_r($user_id); die;
    if (empty(user_id)) {
      //$this->session->set_flashdata('error_message', "VPS product can not be found");
      return false;
    }
    let vps_upate_user_data = {
      email: user_new_info['user_email']
    }
    const [result, message] = await whm.updateUser(vps_order_detail, vps_upate_user_data);

    if (!result) {
      //$this->session->set_flashdata('error_message', $message);
      return false;
    } else {
      return true;
    }
  }

  public changeStatus = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let user_id = get_data_value(post_param, 'user_id');
    let condition = { id: user_id }
    let info = await userService.getOne(condition);
    if (!empty(info)) {
      let update_data = { status: post_param['status'] }
      let message = 'User has been activated successfully.';
      if (intval(post_param['status']) === 0) {
        message = 'User has been blocked successfully.';
      }
      if (!empty(update_data)) {
        await userService.update(update_data, condition);
      }
      return this.json_output_data(data, message)
    } else {
      let message = "User does not exist";
      return this.json_output_error(message)
    }
  };

  /// api for download
  public Download = async (req: Request, res: Response) => {
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    //let data = this.data;
    let token = get_data_value(post_param, 'token')

    let user = await this.checkLoginToken(token) 
    if (empty(user)) {
      res.status(200).end();
      return false
    }
    if(user['admin_type'] !== 'superadmin'){
      res.status(200).end();
      return false
    }
    console.log('admin info', user)

    /**************************************************************************************************/
    let option_list = {
      all: 'All',
      active: 'Active users',
      active_customer: 'Active customers',
      affiliate: 'Affiliates',
      both: 'Both',
      inactive_users: 'Inactive users'
    }
    let option = get_data_value(post_param, 'option', 'all');
    if(option===""){
      option = "all"
    }
    let option_text = get_data_value(option_list, option);
    let header = ['Email address'];
    let excel_data = await this.getExportData(option);
    let filename = "Users_" + option_text + ".xlsx";

    let workbook = new Excel.Workbook();
    //workbook.creator = 'Me';
    let worksheet = workbook.addWorksheet("Users");
    
    worksheet.columns = [
      { header: "Email", key: "user_email", width: 100 }
    ];
    
    let rows = copy_object(excel_data);
 
    // Add Array Rows
    worksheet.addRows(rows);
    //worksheet.addRow({user_email: 'aaaa@gmail.com'});
    
    // res is a Stream object
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + filename
    );
    
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
    //this->exportFile($filename, $data, $header);
  }
  private getExportData = async (option: string) => {
    let searchQuery = " and (user_type = 0 or user_type = 1)";
    if (option == 'active') {
      searchQuery += " and is_active = 1";
    } else if (option == 'active') {
      searchQuery += " and is_active = 1";
    } else if (option == 'active_customer') {
      searchQuery += " and is_active = 1 and user_type = 0";
    } else if (option == 'affiliate') {
      searchQuery += " and is_active = 1 and user_type = 1";
    } else if (option == 'both') {
      searchQuery += " and is_active = 1 and user_type = 1";
    } else if (option == 'inactive_users') {
      searchQuery += " and is_active = 0";
    }
    let sql = "select id, user_email, add_timestamp from " + TB_USER + " where 1=1" + searchQuery + " order by id asc";
    let query_res = await userService.query(sql);
    let row_list = []
    for (let key in query_res) {
      let row = query_res[key]
      if (option == 'affiliate') {
        let check = await userService.check_user_has_active_license(row['id']);
        if (check) {
          continue;
        }
      } else if (option == 'both') {
        let check = await userService.check_user_has_active_license(row['id']);
        if (!check) {
          continue;
        }
      }
      let record = {
        user_email: row['user_email']
      }
      row_list.push(record)
    }
    return row_list;
  }


}

export const adminUserController = new AdminUserController()
