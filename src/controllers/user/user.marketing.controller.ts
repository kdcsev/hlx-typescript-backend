import { Request, Response } from 'express'
import * as mysql from 'mysql2';
import { BASE_FRONT_URL, RANK_CRON_MODE } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, get_data_value, get_utc_timestamp, intval, in_array, isset } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_LICENSE, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { MLM_LEG_COUNT } from '../../var/config';

export default class UserMarketingController extends UserBaseController {
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
    let user_id = user['id'];
    let user_tree_rank: any;
    if (RANK_CRON_MODE !== 'true') { //if every thing is done(cron), we will set this as false //todo
      user_tree_rank = await userService.getUserRank(user_id);
    } else {
      user_tree_rank = {}
      user_tree_rank['tree_info'] = await userService.get_user_tree_only(user['encrypted_id']);
      let rank_info = {}
      if (user['rank_name'] !== "") {
        rank_info = {
          rank_no: user['rank_no'],
          rank_name: user['rank_name']
        }
        user_tree_rank['rank_info'] = rank_info;
      }
    }

    //print_r($user_tree_rank); die;
    let next_rank_no = 11; //VIP
    if (!empty(get_data_value(user_tree_rank, 'rank_info'))) {
      data['rank_info'] = user_tree_rank['rank_info'];
      if (!empty(get_data_value(data['rank_info'], 'rank_no'))) {
        let current_rank_no = intval(data['rank_info']['rank_no']);
        next_rank_no = current_rank_no - 1;
      }
    }
    //$next_rank_no = 2;//for testing
    let next_rank_info = await rankRuleService.get_rank_rule_detail(next_rank_no);
    data['next_rank_info'] = next_rank_info;

    let missing_rank_list = this._get_missing_rank_list(user_tree_rank, next_rank_info);
    data['missing_rank_list'] = missing_rank_list;
    let rank_rule_list = await rankRuleService.getAll({});
    rank_rule_list = array_under_reset(rank_rule_list, 'rank_no');
    data['rank_rule_list'] = rank_rule_list;
    let missing_rank_message = "";
    let missing_rank_message_arr = []
    if (!empty(missing_rank_list)) {
      for (let rank_no in missing_rank_list) {
        let cnt = missing_rank_list[rank_no]
        if (cnt > 0) {
          missing_rank_message_arr.push(cnt + ' ' + rank_rule_list[rank_no]['rank_name'])
        }
      }
    }
    if (!empty(missing_rank_message_arr)) {
      missing_rank_message = missing_rank_message_arr.join(' and ')
    }
    data['missing_rank_message'] = missing_rank_message;

    if (!empty(get_data_value(user_tree_rank, 'tree_info'))) {
      data['tree_info'] = user_tree_rank['tree_info'];
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////     

    /************************************* get all tree user list *******************************************/
    let tree_user_list = await this.get_all_users_in_tree(user_id, 0); //??
    let user_ids = [];
    for (let key in tree_user_list) {
      let row = tree_user_list[key]
      user_ids.push(intval(row['user_id']))
    }
    let all_users_in_tree = <any>[]
    if (!empty(user_ids)) {
      let sql = "select id, user_type, user_name, user_email, is_active from " + TB_USER + " where id in (" + (user_ids.join(',')) + ") order by user_name asc";
      ///sql += " limit 0, 10"; //for tmp
      all_users_in_tree = await userService.query(sql);
    }
    data['all_users_in_tree'] = all_users_in_tree;
    ///////////////////////////////////////////////////end get all tree user list ////////////////////////////////////////////////////////////////////

    if (!empty(data['next_rank_info'])) {
      let destination_personal_referrals = 3;
      let personal_referrals = 0;
      let error_msg_arr = [];
      for (let i = 0; i < 3; i++) {
        personal_referrals += intval(data['tree_info'][i]['active_personal_referral_all_cnt'])
        if (data['tree_info'][i]['active_personal_referral_all_cnt'] === 0) {
          error_msg_arr.push("lane " + (i + 1))
        }
      }
      let error_msg = "";
      if (!empty(error_msg_arr)) {
        error_msg = '(Personal referral missing on ' + (error_msg_arr.join(' and ')) + ')';
      }
      data['destination_personal_referrals'] = destination_personal_referrals
      data['personal_referrals'] = personal_referrals
      data['error_msg_arr'] = error_msg_arr
      data['error_msg'] = error_msg
    }
    if (!empty(data['tree_info'])) {
      for (let i in data['tree_info']) {
        let tree_item = data['tree_info'][i]
        let percent = 0;
        if (intval(tree_item['active_member_cnt']) > 0) {
          percent = Math.round(100 * 100 * tree_item['active_customer_cnt'] / (intval(tree_item['active_member_cnt']))) / 100;
        }
        data['tree_info'][i]['percent'] = percent
      }
    }
    return this.json_output_data(data);
  }

  public getUserRankDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    //return this.json_output_data(data);
    let user_id = get_param['user_id'];

    let user_tree_rank: any;
    if (RANK_CRON_MODE !== 'true') { //if every thing is done(cron), we will set this as false //todo
      user_tree_rank = await userService.getUserRank(user_id);
    } else {
      user_tree_rank = {}
      let root_user = await userService.getOne({id: user_id})
      user_tree_rank['tree_info'] = await userService.get_user_tree_only(root_user['encrypted_id']);
      let rank_info = {}
      if (root_user['rank_name'] !== "") {
        rank_info = {
          rank_no: root_user['rank_no'],
          rank_name: root_user['rank_name']
        }
        user_tree_rank['rank_info'] = rank_info;
      }
    }

    //print_r($user_tree_rank); die;
    let next_rank_no = 11; //VIP
    if (!empty(get_data_value(user_tree_rank, 'rank_info'))) {
      data['rank_info'] = user_tree_rank['rank_info'];
      if (!empty(get_data_value(data['rank_info'], 'rank_no'))) {
        let current_rank_no = intval(data['rank_info']['rank_no']);
        next_rank_no = current_rank_no - 1;
      }
    }
    //$next_rank_no = 2;//for testing
    let next_rank_info = await rankRuleService.get_rank_rule_detail(next_rank_no);
    data['next_rank_info'] = next_rank_info;

    let missing_rank_list = this._get_missing_rank_list(user_tree_rank, next_rank_info);
    data['missing_rank_list'] = missing_rank_list;
    let rank_rule_list = await rankRuleService.getAll({});
    rank_rule_list = array_under_reset(rank_rule_list, 'rank_no');
    data['rank_rule_list'] = rank_rule_list;
    let missing_rank_message = "";
    let missing_rank_message_arr = []
    if (!empty(missing_rank_list)) {
      for (let rank_no in missing_rank_list) {
        let cnt = missing_rank_list[rank_no]
        if (cnt > 0) {
          missing_rank_message_arr.push(cnt + ' ' + rank_rule_list[rank_no]['rank_name'])
        }
      }
    }
    if (!empty(missing_rank_message_arr)) {
      missing_rank_message = missing_rank_message_arr.join(' and ')
    }
    data['missing_rank_message'] = missing_rank_message;

    if (!empty(get_data_value(user_tree_rank, 'tree_info'))) {
      data['tree_info'] = user_tree_rank['tree_info'];
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let user_base_tree = await this.get_main_lane_users(user_id);
    for (let key in user_base_tree) {
      let info = user_base_tree[key]
      let sub_user_id = intval(get_data_value(info, 'user_id'));
      let user_ids = [];
      if (sub_user_id > 0) {
        let sub_tree_user_list = await this.get_all_users_in_tree(sub_user_id, 0);
        for (let k in sub_tree_user_list) {
          let row = sub_tree_user_list[k]
          user_ids.push(intval(row['user_id']))
        }
      }
      user_base_tree[key]['user_ids'] = user_ids;
    }
    data['user_base_tree'] = user_base_tree;
    //print_r($user_base_tree); die;

    if (!empty(data['next_rank_info'])) {
      let destination_personal_referrals = 3;
      let personal_referrals = 0;
      let error_msg_arr = [];
      for (let i = 0; i < 3; i++) {
        personal_referrals += intval(data['tree_info'][i]['active_personal_referral_all_cnt'])
        if (data['tree_info'][i]['active_personal_referral_all_cnt'] === 0) {
          error_msg_arr.push("lane " + (i + 1))
        }
      }
      let error_msg = "";
      if (!empty(error_msg_arr)) {
        error_msg = '(Personal referral missing on ' + (error_msg_arr.join(' and ')) + ')';
      }
      data['destination_personal_referrals'] = destination_personal_referrals
      data['personal_referrals'] = personal_referrals
      data['error_msg_arr'] = error_msg_arr
      data['error_msg'] = error_msg
    }
    if (!empty(data['tree_info'])) {
      for (let i in data['tree_info']) {
        let tree_item = data['tree_info'][i]
        let percent = 0;
        if (intval(tree_item['active_member_cnt']) > 0) {
          percent = Math.round(100 * 100 * tree_item['active_customer_cnt'] / (intval(tree_item['active_member_cnt']))) / 100;
        }
        data['tree_info'][i]['percent'] = percent
      }
    }
    return this.json_output_data(data);
  }

  private get_lane_number = (user_base_tree: any, user_id: number | string) => {
    for (let key in user_base_tree) {
      let info = user_base_tree[key]
      if (info['user_id'] == user_id) {
        return intval(key) + 1;
      }
      let user_ids = get_data_value(info, 'user_ids');
      if (empty(user_ids)) user_ids = [];
      if (in_array(user_id, user_ids)) {
        return intval(key) + 1;
      }
    }
    return false;
  }
  private get_main_lane_users = async (user_id: number | string) => {
    let user_info = await userService.getOne({ id: user_id });
    let condition = { tree_parent_id: user_info['encrypted_id'] }
    let child_list = await treeService.getAll(condition, "tree_position asc");
    if (!empty(child_list)) {
      child_list = array_under_reset(child_list, 'tree_position');
    }
    let child_list_reset = [];
    for (let i = 0; i < MLM_LEG_COUNT; i++) {
      if (!empty(child_list[i])) {
        let child_user_info = child_list[i];
        child_list_reset[i] = child_user_info;
      } else {
        child_list_reset[i] = this.get_empty_user();
      }
    }
    return child_list_reset;
  }
  private get_empty_user = () => {
    let user_info = {
      id: '0',
      user_id: '0',
      encrypted_id: '0',
      user_name: 'Empty',
      user_image: "",
      has_downline: '0'
    }
    return user_info;
  }
  private get_all_users_in_tree = async (user_id: number | string, deep = 0) => {
    let user_info = await userService.getOne({ id: user_id });
    if (empty(user_info)) {
      return [];
    }
    let condition = { tree_parent_id: user_info['encrypted_id'] }
    let child_list = await treeService.getAll(condition, "tree_position asc")
    //print_r($child_list); die;
    if (empty(child_list)) {
      return [];
    }
    let child_list_final = copy_object(child_list)
    for (let key in child_list) {
      let info = child_list[key]
      let user_id1 = info['user_id'];
      let item_list = await this.get_all_users_in_tree(user_id1, deep + 1);
      //print_r($item_list);
      if (!empty(item_list)) {
        child_list_final = array_merge(child_list_final, item_list);
      }
    }
    return child_list_final;
  }
  private _get_missing_rank_list = (user_tree_rank: any, next_rank_info: any = []) => {
    let total_rank_user_cnt_list = {};
    if (!empty(get_data_value(user_tree_rank, 'tree_info'))) {
      let tree_info = user_tree_rank['tree_info'];
      for (let key in tree_info) {
        let lane_info = tree_info[key]
        let rank_user_cnt_list = lane_info['rank_user_cnt_list'];
        if (!empty(rank_user_cnt_list)) {
          for (let rank_no in rank_user_cnt_list) {
            let cnt = rank_user_cnt_list[rank_no]
            if (!empty(get_data_value(total_rank_user_cnt_list, rank_no))) {
              total_rank_user_cnt_list[rank_no] = total_rank_user_cnt_list[rank_no] + 1;
            } else {
              total_rank_user_cnt_list[rank_no] = 1;
            }
          }
        }
      }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let missing_rank_list = {}
    if (!empty(next_rank_info)) {
      let rank_no = intval(next_rank_info['rank_no']);

      if (rank_no === 11 || rank_no === 10 || rank_no === 9) { /*VIP, LEADER600, LEADER1500*/
        return missing_rank_list;
      }
      else if (rank_no === 8) {/*ADVISOR3K*/
        /*foreach($rank_user_cnt_list as $key=>$rank_user_count_list){
            if(!isset($rank_user_count_list[11]) || intval($rank_user_count_list[11]) < 3){
                return false;
            }
        }*/
        return missing_rank_list;
      }
      else if (rank_no === 7) {/*ADVISOR5K*/
        let main_rank_no = 10;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 6) {/*BOSS10K*/
        let main_rank_no = 9;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 5) {/*BOSS25K*/
        let main_rank_no = 8;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 4) {/*BOSS50K*/
        let main_rank_no = 7;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 3) {/*MENTOR100*/
        let main_rank_no = 6;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 2) {/*MENTOR250*/
        let main_rank_no = 5;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 1) {/*BARON*/
        let main_rank_no = 4;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
      else if (rank_no === 0) {/*MAGNATE*/
        let main_rank_no = 3;
        let vip_rank_no = 11;
        let missing_main_rank_cnt = 2;
        let missing_vip_rank_cnt = 1;
        if (isset(total_rank_user_cnt_list[main_rank_no])) {
          missing_main_rank_cnt = 2 - intval(total_rank_user_cnt_list[main_rank_no]);
        }
        if (isset(total_rank_user_cnt_list[vip_rank_no])) {
          missing_vip_rank_cnt = 1 - intval(total_rank_user_cnt_list[vip_rank_no]);
        }
        missing_rank_list[main_rank_no] = missing_main_rank_cnt;
        missing_rank_list[vip_rank_no] = missing_vip_rank_cnt;
        return missing_rank_list;
      }
    }
    return missing_rank_list;
  }

  public getDataList = async (req: Request, res: Response) => { //api for datatable
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let user_id = user['id'];
    /************************************* get all tree user list *******************************************/
    let user_base_tree = await this.get_main_lane_users(user_id);
    for (let key in user_base_tree) {
      let info = user_base_tree[key]
      let sub_user_id = intval(get_data_value(info, 'user_id'));
      let user_ids = [];
      if (sub_user_id > 0) {
        let sub_tree_user_list = await this.get_all_users_in_tree(sub_user_id, 0);
        for (let k in sub_tree_user_list) {
          let row = sub_tree_user_list[k]
          user_ids.push(intval(row['user_id']))
        }
      }
      user_base_tree[key]['user_ids'] = user_ids;
    }
    data['user_base_tree'] = user_base_tree;

    let tree_user_list = await this.get_all_users_in_tree(user_id, 0); //??
    let user_ids = [];
    for (let key in tree_user_list) {
      let row = tree_user_list[key]
      user_ids.push(intval(row['user_id']))
    }
    let per_page = intval(get_data_value(get_param, 'per_page', 10))

    let sql = "select u.id, u.user_type, u.user_name, u.user_email, u.is_active from " + TB_USER + " as u where u.user_verified = '1'";
    if (get_param['user_kind'] === 'both') {
      sql = "select u.id, u.user_type, u.user_name, u.user_email, u.is_active from " + TB_USER + " as u join " + TB_LICENSE + " as b on u.id = b.user_id where b.status = '1' and u.user_verified = '1'";
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
      } else if (get_param['user_kind'] === 'personal_referral') {
        sql += " and u.ref_id = '" + user['encrypted_id'] + "'";
      }
    }
    if (empty(user_ids)) {
      sql += " and 1 <> 1";
    }else{
      sql += " and u.id in (" + (user_ids.join(',')) + ")";
    }
    if (isset(get_param['keyword1']) && !empty(get_param['keyword1'])) {
      let keyword1 = get_param['keyword1']
      //keyword1 = "%" + keyword1 + "%";
      keyword1 = mysql.escape(keyword1);
      sql += " and (u.user_name = " + keyword1 + ")";
    }
    sql += " group by u.id";
  
    // if (isset(get_param['sort_column'])) {
    //   let sort_direction = get_data_value(get_param, 'sort_direction', 'asc')
    //   sql += " order by " + get_param['sort_column'] + " " + sort_direction
    // } else {
    //   sql += " order by user_name asc";
    // }
    sql += " order by u.user_name asc";

    //console.log('==================sql================', sql);

    let rows = await licenseService.query(sql) as []
    let total = rows.length;
    let page = intval(get_data_value(get_param, 'page', 1))
    let offset = (page - 1) * per_page;
    sql += " limit " + offset + "," + per_page;

    let all_users_in_tree = await userService.query(sql);
    if (empty(all_users_in_tree)) all_users_in_tree = []
    for (let key in all_users_in_tree) {
      let row = all_users_in_tree[key]
      let check_user_has_active_license = await userService.check_user_has_active_license(row['id']);
      all_users_in_tree[key]['check_user_has_active_license'] = check_user_has_active_license;
      let user_is_trial = await userService.check_user_has_trial_license(row['id']);
      all_users_in_tree[key]['user_is_trial'] = user_is_trial;
      let lane = this.get_lane_number(user_base_tree, row['id']);
      all_users_in_tree[key]['lane_number'] = lane;
      if (intval(row['user_type']) === 1) {
        if (RANK_CRON_MODE !== 'true') { //if every thing is done(cron), we will set this as false //todo
          let user_tree_rank = await userService.getUserRank(row['id']);
          all_users_in_tree[key]['rank_info'] = user_tree_rank['rank_info'];
        }else{
          let user_tree_one = await userService.getOne({id: row['id']});
          let rank_name = get_data_value(user_tree_one, 'rank_name')
          if(rank_name!==""){
            let rank_info = {
              rank_no: get_data_value(user_tree_one, 'rank_no', 0),
              rank_name: rank_name
            }
            all_users_in_tree[key]['rank_info'] = rank_info
          }
        }        
      }
      let check_user_has_free_license = await userService.check_user_has_free_license(row['id']);
      all_users_in_tree[key]['check_user_has_free_license'] = check_user_has_free_license;

      let item = all_users_in_tree[key]
      let status = "";
      let status_class = "text-danger";
      if (intval(item['user_type']) === 0) {
        if (intval(item['is_active']) === 1) {
          if (item['user_is_trial']) {
            status = "On Trial";
            status_class = "text-success";
          } else {
            if (item['check_user_has_free_license']) {
              status = "Customer with free membership";
              status_class = "text-success";
            } else {
              status = "Customer";
              status_class = "text-success";
            }
          }
        } else {
          status = "Inactive";
        }
      } else if (intval(item['user_type']) === 1) {
        if (intval(item['is_active']) === 1) {
          if (item['check_user_has_active_license']) {
            status = "Both";
            status_class = "text-info text-bold";
          } else {
            status = "Affiliate";
            status_class = "text-info";
          }
        } else {
          status = "Inactive";
        }
      }
      all_users_in_tree[key]['status'] = status;
      all_users_in_tree[key]['status_class'] = status_class;
    }
    //data['all_users_in_tree'] = all_users_in_tree;
    data['page'] = page;
    data['per_page'] = per_page;
    data['total'] = total;

    let total_pages = 0
    if (total > 0) {
      total_pages = Math.ceil(total / per_page)
    }
    data['total_pages'] = total;
    data['data'] = all_users_in_tree;

    return res.json(data)
  }





}

export const userMarketingController = new UserMarketingController()
