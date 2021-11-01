import { LICENSE_LIFE_TIME, MLM_LEG_COUNT, RULE_PERCENT, TRIAL_LICENSE_DURATION } from "../var/config";
import { array_merge, array_under_reset, copy_object, empty, get_data_value, get_time_remain, get_utc_timestamp, intval, isset, is_empty, rsort, unset, usort } from "../helpers/misc";
import { TB_LICENSE, TB_USER } from "../var/tables";
import { BaseService } from "./base.service";
import { holdingTankService } from "./holding.tank.service";
import { treeService } from "./tree.service";
import { rankRuleService } from "./rank.rule.service";
import { RowDataPacket } from "mysql2";
import { licenseService } from "./license.service";

export default class UserService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_USER;
  }

  //check if account is duplicated or not
  //true: account is duplicated, false: not duplicated 
  public checkDuplicatedAccount = async (account_info: object) => {
    let result: object = {
      is_duplicated: false,
      message: ""
    };
    if (is_empty(account_info['id'])) {
      account_info['id'] = 0;
    }
    let base_sql: string = "select * from " + TB_USER + " where id <> " + account_info['id'];
    if (!is_empty(account_info['user_name'])) {
      let sql: string = base_sql + " and user_name = ? limit 0,1";
      let values = [account_info['user_name']];
      let rows = await this.query(sql, values);
      if (!is_empty(rows[0])) {
        result['is_duplicated'] = true;
        result['message'] = "Username is already taken";
        return [result['is_duplicated'], result['message']];
      }
    }
    if (!is_empty(account_info['user_email'])) {
      let sql: string = base_sql + " and user_email = ? limit 0,1";
      let values = [account_info['user_email']];
      let rows = await this.query(sql, values);
      if (!is_empty(rows[0])) {
        result['is_duplicated'] = true;
        result['message'] = "Email address is already taken";
        return [result['is_duplicated'], result['message']];
      }
    }
    if (!is_empty(account_info['user_phone'])) {
      let sql: string = base_sql + " and user_phone = ? limit 0,1";
      let values = [account_info['user_phone']];
      let rows = await this.query(sql, values);
      if (!is_empty(rows[0])) {
        result['is_duplicated'] = true;
        result['message'] = "Phone number is already taken";
        return [result['is_duplicated'], result['message']];
      }
    }
    return [result['is_duplicated'], result['message']];
  }
  public checkParentIsCustomer = async (user_info: object) => { //check ref parent is only customer
    let ref_id = user_info['ref_id'];
    if (!empty(ref_id)) {
      let parent_user = await this.getOne({ encrypted_id: ref_id });
      if (!empty(parent_user)) {
        let user_type: number = parent_user['user_type'] as number;
        if (user_type === 0) {
          return true;
        }
      }
    }
    return false;
  }
  public assign_child_user = async (parent_encrypted_id: string, user_id: string | number) => {
    let condition = { tree_child_id: user_id };
    await holdingTankService.delete(condition);
    let parent_info = await this.getOne({ encrypted_id: parent_encrypted_id });
    if (empty(parent_info)) return false;
    let user_info = await this.getOne({ id: user_id });
    if (empty(user_info)) return false;

    let tree_parent_id = parent_info['encrypted_id'];
    let parent_tree_info = await treeService.getOne({ encrypted_id: tree_parent_id });
    if (empty(parent_tree_info)) return false;

    let check = await this.checkUserInTree(user_id);
    if (check) {
      return false;
    }
    let parent_tree_level: number = parent_tree_info['tree_level'] as number;
    let search_result = await this.searchAvailableAssignTree(parent_encrypted_id, parent_tree_level + 1);
    let default_lane_arr = this.get_default_lane_arr()
    let tree_data = {
      user_id: user_info['id'],
      encrypted_id: user_info['encrypted_id'],
      tree_level: search_result['level'],
      tree_parent_id: search_result['tree_parent_id'],
      tree_position: search_result['tree_position'],
      available_lane: default_lane_arr.join(','),
      add_timestamp: get_utc_timestamp()
    }

    let tree_info = await treeService.getOne({ user_id: tree_data['user_id'], tree_parent_id: tree_data['tree_parent_id'] });
    if (empty(tree_info)) {
      await treeService.insert(tree_data);
    }
    await this.checkLaneFull(tree_parent_id);
    return true;
  }
  public get_default_lane_arr = () => {
    let default_lane_arr = [];
    let i: number = 0;
    for (i = 0; i < MLM_LEG_COUNT; i++) {
      default_lane_arr.push(i)
    }
    return default_lane_arr;
  }
  public checkUserInTree = async (user_id: number | string) => {
    let condition = { id: user_id }
    let user_info = await this.getOne(condition)
    if (!empty(user_info)) {
      let where = {
        user_id: user_info['id']
      }
      let check = await treeService.getOne(where);
      if (!empty(check)) { //user is in the tree
        return true;
      } else { //user is not in the tree
        return false;
      }
    } else {
      return false;
    }
  }
  public searchAvailableAssignTree = async (tree_parent_id: number | string, level: number = 0, child_list: any = []) => {
    if (empty(child_list)) {
      let condition = { tree_parent_id: tree_parent_id };
      let pos: number = 0;
      for (pos = 0; pos < MLM_LEG_COUNT; pos++) {
        condition['tree_position'] = pos;
        let child_info = await treeService.getOne(condition);
        if (empty(child_info)) {
          return { tree_parent_id: tree_parent_id, tree_position: pos, level: level };
        } else {
          child_list.push(child_info)
        }
      }
    }
    let i: number = 0;
    for (i = 0; i < child_list.length; i++) {
      let child_info = child_list[i];
      if (child_info['available_lane'] != "") {
        let available_arr = child_info['available_lane'].split(',')
        let pos: number = await this.getAssignTreePos(child_info['encrypted_id']);
        if (pos > -1) {
          return { tree_parent_id: child_info['encrypted_id'], tree_position: pos, level: level + 1 }
        }
      }
    }
    let child_child_list = await this.getChildList(child_list);
    return await this.searchAvailableAssignTree(tree_parent_id, level + 1, child_child_list);
  }
  public getAssignTreePos = async (encrypted_id: number | string) => {
    let pos: number = -1;
    let default_lane_arr = this.get_default_lane_arr();
    let child_list = await treeService.getAll({ tree_parent_id: encrypted_id }, "tree_position asc");
    if (!empty(child_list)) {
      if (child_list.length < MLM_LEG_COUNT) {
        let i: number = 0;
        for (i = 0; i < child_list.length; i++) {
          let child_info = child_list[i];
          let tree_position = parseInt(child_info['tree_position'])
          if (tree_position >= 0) {
            default_lane_arr = unset(default_lane_arr, tree_position);
          }
        }
        if (!empty(default_lane_arr)) {
          let default_lane_str = default_lane_arr.join(',')
          default_lane_arr = default_lane_str.split(',')
          pos = parseInt(default_lane_arr[0]);
        }
      }
    } else {
      pos = parseInt(default_lane_arr[0]);
    }
    return pos;
  }
  public checkLaneFull = async (encrypted_id: number | string) => {
    let default_lane_arr = this.get_default_lane_arr();
    let child_list = await treeService.getAll({ tree_parent_id: encrypted_id });
    if (!empty(child_list)) {
      let available_lane = "";
      if (child_list.length < MLM_LEG_COUNT) {
        for (let i = 0; i < child_list.length; i++) {
          let child_info = child_list[i];
          let tree_position: number = parseInt(child_info['tree_position']);
          if (tree_position >= 0) {
            default_lane_arr = unset(default_lane_arr, tree_position);
          }
        }
        if (!empty(default_lane_arr)) {
          available_lane = default_lane_arr.join(',')
        }
      }
      let update_data = { available_lane: available_lane }
      let condition = { encrypted_id: encrypted_id }
      await treeService.update(update_data, condition);
    }
  }
  public getChildList = async (tree_list: any) => {
    let child_list = [];
    for (let i = 0; i < tree_list.length; i++) {
      let info = tree_list[i];
      let condition = { tree_parent_id: info['encrypted_id'] }
      let new_list = <any[]>await treeService.getAll(condition, "tree_position asc");
      if (!empty(new_list)) {
        child_list = [...child_list, ...new_list];
      }
    }
    return child_list;
  }
  public setHoldingTank = async (user_info: any) => {
    if (!empty(user_info['ref_id'])) { //if user is referred user
      let condition = { encrypted_id: user_info['ref_id'] }
      let parent_info = await this.getOne(condition);
      if (!empty(parent_info)) {
        let holding_info = await holdingTankService.getOne({ tree_child_id: user_info['id'] });
        if (empty(holding_info)) {
          let holding_tank_data = {
            tree_parent_id: parent_info['encrypted_id'],
            tree_child_id: user_info['id'],
            add_timestamp: get_utc_timestamp()
          }
          await holdingTankService.insert(holding_tank_data);
        }
        return true;
      } else {
        await this.update({ ref_id: '' }, { id: user_info['id'] });
      }
    }

    //if user is non-referred user
    let condition = { id: 1 }
    let top_user_info = await this.getOne(condition);
    if (empty(top_user_info)) {
      top_user_info = {
        encrypted_id: ""
      }
      return false;
    }
    let tree_parent_id = top_user_info['encrypted_id']
    let holding_tank_data = {
      tree_parent_id: tree_parent_id,
      tree_child_id: user_info['id'],
      add_timestamp: get_utc_timestamp()
    }
    let tank_info = await holdingTankService.getOne({ tree_child_id: user_info['id'] });
    if (empty(tank_info)) {
      await holdingTankService.insert(holding_tank_data);
    } else {
      delete holding_tank_data['tree_child_id'];
      await holdingTankService.update(holding_tank_data, { tree_child_id: user_info['id'] })
    }
    return true;
  }
  public becomeAffiliate = async (user_id: number | string) => {
    let condition = { id: user_id }
    let update_data = {
      user_type: 1,
      is_paid: 1,
      is_active: 1,
      auto_commission: '',
      last_commission_timestamp: get_utc_timestamp()
    }
    await this.update(update_data, condition);
    await this.update({ license_status: 1 }, { id: user_id }); //remove freelicense status
  }
  public checkUserInHoldingTank = async (user_id: number | string) => {
    let condition = { id: user_id }
    let user_info = await this.getOne(condition);
    if (!empty(user_info)) {
      let where = {
        tree_child_id: user_info['id']
      }
      let check = await holdingTankService.getOne(where);
      if (!empty(check)) { //user is in the holding tank
        return true;
      } else { //use is not in holding tank
        return false;
      }
    } else {
      return false;
    }
  }
  public check_has_downline = async (condition: object) => {
    let info = await treeService.getOne(condition);
    let result = '0';
    if (!empty(info)) {
      result = '1';
    }
    return result;
  }

  /*****************************Ranking system**********************************/
  public getUserRank = async (user_id: number | string) => {
    let rank_list = await rankRuleService.getAll({ status: 1 }, 'rank_no desc');
    if (empty(rank_list)) rank_list = <RowDataPacket>[];
    for (let key in rank_list) {
      let rank_info = rank_list[key]
      rank_info['line_max'] = rank_info['line_max'].split('/')
      rank_info['line_max'] = rsort(rank_info['line_max']);
      rank_list[key]['line_max'] = rank_info['line_max'];
    }
    //return $rank_list;
    let where = { id: user_id }
    let user_info = await this.getOne(where);
    if (empty(user_info)) {
      return false;
    }
    let user_tree_info = await this.get_user_tree(user_info['encrypted_id']);
    let user_tree_info_origin = copy_object(user_tree_info);
    let user_tree_info_data = copy_object(user_tree_info);
    user_tree_info = usort(user_tree_info, 'active_member_cnt')
    let selected_rank_index = 0;
    let all_valid = true;
    for (let i = 0; i < rank_list.length; i++) {
      let is_valid = true;
      for (let key in user_tree_info) {
        let tree_info = user_tree_info[key]
        let line_max = rank_list[i]['line_max'];
        if (parseInt(tree_info['active_member_cnt']) < parseInt(line_max[key])) { //////////////////////////////////
          is_valid = false;
          all_valid = false;
        }
      }
      if (!is_valid) {
        selected_rank_index = i - 1;
        all_valid = false;
        break;
      } else {
        let is_valid1 = await this.checkValidRank(user_info['encrypted_id'], user_tree_info, rank_list[i]);
        if (!is_valid1) {
          selected_rank_index = i - 1;
          all_valid = false;
          break;
        }
      }
    }
    if (selected_rank_index >= 0) {
      if (all_valid) selected_rank_index = rank_list.length - 1;
      let rank_info1 = rank_list[selected_rank_index];
      let check_rule_percent = await this.check_rule_percent(user_tree_info_origin)
      if (check_rule_percent) {
        return { rank_info: rank_info1, tree_info: user_tree_info_data }
      } else {
        rank_info1 = await this.recalcUserRank(user_tree_info_origin, user_info);
        return { rank_info: rank_info1, tree_info: user_tree_info_data }
      }
    } else {
      return { rank_info: {}, tree_info: user_tree_info_data }
    }
  }
  public check_rule_percent = async (user_tree_info_origin) => { //check if satisfy rule percent
    //$this->add_log(json_encode($user_tree_info_origin));
    /*****************check 66% rule**************/
    let percent = 0;
    let is_valid = true;
    for (let key in user_tree_info_origin) {
      let tree_info = user_tree_info_origin[key]
      //$total_members = intval($tree_info['affiliate_cnt']) + intval($tree_info['customer_cnt']);
      let total_members = parseInt(tree_info['active_member_cnt']);
      if (total_members > 0) {
        percent = parseInt(tree_info['active_customer_cnt']) / total_members;
      } else {
        percent = 0;
      }
      if (percent < RULE_PERCENT) {
        is_valid = false;
        return false;
      }
    }
    return is_valid;
    /*********************************************/
  }
  public recalcUserRank = async (user_tree_info_origin, user_info) => {
    let percent = 0;
    for (let key in user_tree_info_origin) {
      let tree_info = user_tree_info_origin[key]
      let total_members = parseInt(tree_info['active_member_cnt']);
      if (total_members > 0) {
        percent = parseInt(tree_info['active_customer_cnt']) / total_members;
      } else {
        percent = 0;
      }
      if (percent < RULE_PERCENT) {
        user_tree_info_origin[key]['affiliate_cnt'] = parseInt(tree_info['active_customer_cnt']) / 2;
        user_tree_info_origin[key]['affiliate_cnt'] = parseInt(user_tree_info_origin[key]['affiliate_cnt']);
        user_tree_info_origin[key]['active_member_cnt'] = parseInt(user_tree_info_origin[key]['affiliate_cnt']) + parseInt(tree_info['active_customer_cnt']);
      }
    }

    ////////////////////////////////////////////////////////////////recalc////////////////////////////////////////////////////////////
    let rank_list = await rankRuleService.getAll({ status: 1 }, 'rank_no desc');
    if (empty(rank_list)) rank_list = <RowDataPacket>[];
    for (let key in rank_list) {
      let rank_info = rank_list[key];
      rank_info['line_max'] = rank_info['line_max'].split('/')
      rank_info['line_max'] = rsort(rank_info['line_max']);
      rank_list[key]['line_max'] = rank_info['line_max'];
    }

    let user_tree_info = copy_object(user_tree_info_origin);
    user_tree_info = usort(user_tree_info, 'active_member_cnt');
    let selected_rank_index = 0;
    let all_valid = true;
    for (let i = 0; i < rank_list.length; i++) {
      let is_valid = true;
      for (let key in user_tree_info) {
        let tree_info = user_tree_info[key]
        let line_max = rank_list[i]['line_max'];
        if (parseInt(tree_info['active_member_cnt']) < parseInt(line_max[key])) {
          is_valid = false;
          all_valid = false;
        }
      }
      if (!is_valid) {
        selected_rank_index = i - 1;
        break;
      } else {
        let is_valid1 = await this.checkValidRank(user_info['encrypted_id'], user_tree_info, rank_list[i]);
        if (!is_valid1) {
          selected_rank_index = i - 1;
          break;
        }
      }
    }
    if (selected_rank_index >= 0) {
      if (all_valid) selected_rank_index = rank_list.length - 1;
      let rank_info1 = rank_list[selected_rank_index];
      return rank_info1;
    } else {
      return {};
    }
  }
  public get_user_tree = async (parent_encrypted_id) => {
    let user_info = await this.getOne({ encrypted_id: parent_encrypted_id });
    if (empty(user_info)) {
      return {};
    }
    let condition = { tree_parent_id: user_info['encrypted_id'] }
    let child_list = await treeService.getAll(condition, "tree_position asc")
    if (!empty(child_list)) {
      child_list = array_under_reset(child_list, 'tree_position');
    }
    let child_list_reset = [];
    for (let i = 0; i < MLM_LEG_COUNT; i++) {
      child_list_reset[i] = {}
      if (!empty(child_list[i])) {
        let child_tree_info = child_list[i];
        let child_tree_list = [];
        child_tree_list.push(child_tree_info);
        let user_list = await this.getTreeAllUsers(child_tree_list);
        child_list_reset[i]['list'] = user_list;
      } else {
        child_list_reset[i]['list'] = [];
      }
      child_list_reset[i]['count'] = 0 + child_list_reset[i]['list'].length
      let affiliate_cnt = 0;
      let customer_cnt = 0;
      let active_member_cnt = 0;
      let active_customer_cnt = 0;
      let personal_referral_cnt = 0;
      let active_personal_referral_cnt = 0;
      let active_personal_referral_all_cnt = 0;
      let rank_user_cnt_list = [];
      //$this->add_log(json_encode($child_list_reset[$i]['list']));
      for (let key in child_list_reset[i]['list']) {
        let info = child_list_reset[i]['list'][key]
        let user_detail = await this.getOne({ id: info['user_id'] })
        child_list_reset[i]['list'][key]['user_info'] = user_detail;
        if (!empty(user_detail) && intval(user_detail['license_status']) !== 2) { // quan free license
          if (parseInt(user_detail['user_type']) === 0) {
            customer_cnt++;
          } else if (parseInt(user_detail['user_type']) === 1) {
            affiliate_cnt++;
          }
          if (parseInt(user_detail['is_active']) === 1 || parseInt(user_detail['user_type']) === 1) {
            active_member_cnt++;
          }
          if (parseInt(user_detail['is_active']) === 1 && parseInt(user_detail['user_type']) === 0) {
            active_customer_cnt++;
          }
          if (user_detail['ref_id'] === parent_encrypted_id) {
            personal_referral_cnt++;
            if (parseInt(user_detail['is_active']) === 1 && parseInt(user_detail['user_type']) === 0) {
              active_personal_referral_cnt++;
            }
            let check_user_has_active_license = await this.check_user_has_active_license(user_detail['id'])
            if (check_user_has_active_license) {
              active_personal_referral_all_cnt++;
            }
          }

          //////////////////////////////////////////////////////////////////////////////////////////
          if (user_detail['ref_id'] === parent_encrypted_id) {
            let child_user_rank_data = await this.getUserRank(user_detail['id']);
            if (!empty(child_user_rank_data['rank_info'])) {
              let rank_no = child_user_rank_data['rank_info']['rank_no'];
              if (!empty(rank_user_cnt_list[rank_no])) {
                rank_user_cnt_list[rank_no] = rank_user_cnt_list[rank_no] + 1;
              } else {
                rank_user_cnt_list[rank_no] = 1;
              }
            }
          }
          /////////////////////////////////////////////////////////////////////////////////////////
        }
      }
      child_list_reset[i]['affiliate_cnt'] = 0 + affiliate_cnt;
      child_list_reset[i]['customer_cnt'] = 0 + customer_cnt;
      child_list_reset[i]['active_customer_cnt'] = 0 + active_customer_cnt;
      child_list_reset[i]['active_member_cnt'] = 0 + active_member_cnt; //total active users
      child_list_reset[i]['personal_referral_cnt'] = 0 + personal_referral_cnt;
      child_list_reset[i]['active_personal_referral_cnt'] = 0 + active_personal_referral_cnt;
      child_list_reset[i]['active_personal_referral_all_cnt'] = 0 + active_personal_referral_all_cnt;
      child_list_reset[i]['rank_user_cnt_list'] = rank_user_cnt_list;
      child_list_reset[i]['position'] = i;
    }
    return child_list_reset;
  }

  public get_user_tree_only = async (parent_encrypted_id) => {
    let user_info = await this.getOne({ encrypted_id: parent_encrypted_id });
    if (empty(user_info)) {
      return {};
    }
    let condition = { tree_parent_id: user_info['encrypted_id'] }
    let child_list = await treeService.getAll(condition, "tree_position asc")
    if (!empty(child_list)) {
      child_list = array_under_reset(child_list, 'tree_position');
    }
    let child_list_reset = [];
    for (let i = 0; i < MLM_LEG_COUNT; i++) {
      child_list_reset[i] = {}
      if (!empty(child_list[i])) {
        let child_tree_info = child_list[i];
        let child_tree_list = [];
        child_tree_list.push(child_tree_info);
        let user_list = await this.getTreeAllUsers(child_tree_list);
        child_list_reset[i]['list'] = user_list;
      } else {
        child_list_reset[i]['list'] = [];
      }
      child_list_reset[i]['count'] = 0 + child_list_reset[i]['list'].length
      let affiliate_cnt = 0;
      let customer_cnt = 0;
      let active_member_cnt = 0;
      let active_customer_cnt = 0;
      let personal_referral_cnt = 0;
      let active_personal_referral_cnt = 0;
      let active_personal_referral_all_cnt = 0;
      let rank_user_cnt_list = [];
      //$this->add_log(json_encode($child_list_reset[$i]['list']));
      for (let key in child_list_reset[i]['list']) {
        let info = child_list_reset[i]['list'][key]
        let user_detail = await this.getOne({ id: info['user_id'] })
        child_list_reset[i]['list'][key]['user_info'] = user_detail;
        if (!empty(user_detail) && intval(user_detail['license_status']) !== 2) { // quan free license
          if (parseInt(user_detail['user_type']) === 0) {
            customer_cnt++;
          } else if (parseInt(user_detail['user_type']) === 1) {
            affiliate_cnt++;
          }
          if (parseInt(user_detail['is_active']) === 1 || parseInt(user_detail['user_type']) === 1) {
            active_member_cnt++;
          }
          if (parseInt(user_detail['is_active']) === 1 && parseInt(user_detail['user_type']) === 0) {
            active_customer_cnt++;
          }
          if (user_detail['ref_id'] === parent_encrypted_id) {
            personal_referral_cnt++;
            if (parseInt(user_detail['is_active']) === 1 && parseInt(user_detail['user_type']) === 0) {
              active_personal_referral_cnt++;
            }
            let check_user_has_active_license = await this.check_user_has_active_license(user_detail['id'])
            if (check_user_has_active_license) {
              active_personal_referral_all_cnt++;
            }
          }

          //////////////////////////////////////////////////////////////////////////////////////////
          // if (user_detail['ref_id'] === parent_encrypted_id) {
          //   let child_user_rank_data = await this.getUserRank(user_detail['id']);
          //   if (!empty(child_user_rank_data['rank_info'])) {
          //     let rank_no = child_user_rank_data['rank_info']['rank_no'];
          //     if (!empty(rank_user_cnt_list[rank_no])) {
          //       rank_user_cnt_list[rank_no] = rank_user_cnt_list[rank_no] + 1;
          //     } else {
          //       rank_user_cnt_list[rank_no] = 1;
          //     }
          //   }
          // }
          /////////////////////////////////////////////////////////////////////////////////////////
        }
      }
      child_list_reset[i]['affiliate_cnt'] = 0 + affiliate_cnt;
      child_list_reset[i]['customer_cnt'] = 0 + customer_cnt;
      child_list_reset[i]['active_customer_cnt'] = 0 + active_customer_cnt;
      child_list_reset[i]['active_member_cnt'] = 0 + active_member_cnt; //total active users
      child_list_reset[i]['personal_referral_cnt'] = 0 + personal_referral_cnt;
      child_list_reset[i]['active_personal_referral_cnt'] = 0 + active_personal_referral_cnt;
      child_list_reset[i]['active_personal_referral_all_cnt'] = 0 + active_personal_referral_all_cnt;
      child_list_reset[i]['rank_user_cnt_list'] = rank_user_cnt_list;
      child_list_reset[i]['position'] = i;
    }
    return child_list_reset;
  }


  public getTreeAllUsers = async (child_tree_list_origin) => {
    let child_tree_list = copy_object(child_tree_list_origin)
    let result: any;
    let child_list = []
    for (let key in child_tree_list) {
      let info = child_tree_list[key]
      let condition = { tree_parent_id: info['encrypted_id'] }
      let list = await treeService.getAll(condition, 'tree_position asc')
      if (!empty(list)) {
        child_list = array_merge(child_list, list);
      }
    }
    if (!empty(child_list)) {
      result = await this.getTreeAllUsers(child_list);
    } else {
      return child_tree_list;
    }
    if (!empty(result)) {
      return array_merge(child_tree_list, result);
    } else {
      return child_tree_list;
    }
  }
  public checkValidRank = async (parent_encrypted_id, user_tree_info, rank_item) => {
    let is_valid = true;
    /*if(!isset($user_tree_info['rank_user_cnt_list']) || empty($user_tree_info['rank_user_cnt_list'])){
        return false;
    }*/

    let rank_no = parseInt(rank_item['rank_no']);
    let rank_user_cnt_list = []
    for (let key in user_tree_info) {
      let info = user_tree_info[key]
      rank_user_cnt_list[key] = info['rank_user_cnt_list'];
    }
    for (let key in user_tree_info) {
      let user_tree_item = user_tree_info[key]
      let tree_list = user_tree_item['list'];
      let is_valid1 = false;
      for (let k in tree_list) {
        let tree_info = tree_list[k]
        let user_info = tree_info['user_info'];
        if (user_info['ref_id'] === parent_encrypted_id) {
          /*if($user_info['is_active'] == 1 && intval($user_info['user_type']) === 0){
              $is_valid1 = true;
          }*/
          let check_user_has_active_license = await this.check_user_has_active_license(user_info['id'])
          if (check_user_has_active_license) {
            let check_user_has_trial_license = await this.check_user_has_trial_license(user_info['id'])
            if(!check_user_has_trial_license) {
              is_valid1 = true;
            }
          }
        }
      }
      if (!is_valid1) {
        return false;
      }
    }
    if (rank_no === 11) { /*3 personal referral in each line*/
      return true;
    }
    else if (rank_no === 10 || rank_no === 9) { /*LEADER600, LEADER1500*/
      /*print_r('----------------------------------------');
      print_r($user_tree_info);*/
      return true;
    }
    else if (rank_no === 8) {/*ADVISOR3K*/
      /*foreach($rank_user_cnt_list as $key=>$rank_user_count_list){
          if(!isset($rank_user_count_list[11]) || intval($rank_user_count_list[11]) < 3){
              return false;
          }
      }*/
      return true;
    }
    else if (rank_no === 7) {/*ADVISOR5K*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list);
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (!empty(rank_user_count_list[10]) && parseInt(rank_user_count_list[10]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (!empty(rank_user_count_list[11]) && parseInt(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (!empty(rank_user_count_list[10]) && parseInt(rank_user_count_list[10]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (!empty(rank_user_cnt_list[index][11]) && parseInt(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 6) {/*BOSS10K*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list);
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (!empty(rank_user_count_list[9]) && parseInt(rank_user_count_list[9]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key];
        if (!empty(rank_user_count_list[11]) && parseInt(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (!empty(rank_user_count_list[9]) && parseInt(rank_user_count_list[9]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (!empty(rank_user_cnt_list[index][11]) && parseInt(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 5) {/*BOSS25K*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list);
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (!empty(rank_user_count_list[8]) && parseInt(rank_user_count_list[8]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt == 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (!empty(rank_user_count_list[11]) && parseInt(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (!empty(rank_user_count_list[8]) && parseInt(rank_user_count_list[8]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (!empty(rank_user_cnt_list[index][11]) && parseInt(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 4) {/*BOSS50K*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list)
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (!empty(rank_user_count_list[7]) && parseInt(rank_user_count_list[7]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (isset(rank_user_count_list[11]) && parseInt(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (isset(rank_user_count_list[7]) && parseInt(rank_user_count_list[7]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (isset(rank_user_cnt_list[index][11]) && parseInt(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 3) {/*MENTOR100*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list)
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (isset(rank_user_count_list[6]) && parseInt(rank_user_count_list[6]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (isset(rank_user_count_list[11]) && intval(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (isset(rank_user_count_list[6]) && intval(rank_user_count_list[6]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (isset(rank_user_cnt_list[index][11]) && intval(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 2) {/*MENTOR250*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list)
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (isset(rank_user_count_list[5]) && intval(rank_user_count_list[5]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (isset(rank_user_count_list[11]) && intval(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (isset(rank_user_count_list[5]) && intval(rank_user_count_list[5]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (isset(rank_user_cnt_list[index][11]) && intval(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 1) {/*BARON*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list)
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (isset(rank_user_count_list[4]) && intval(rank_user_count_list[4]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (isset(rank_user_count_list[11]) && intval(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (isset(rank_user_count_list[4]) && intval(rank_user_count_list[4]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (isset(rank_user_cnt_list[index][11]) && intval(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
    else if (rank_no === 0) {/*MAGNATE*/
      let rank_user_cnt_list_origin = copy_object(rank_user_cnt_list)
      let main_rank_cnt = 0;
      let vip_rank_cnt = 0;
      let main_index_list = [];
      for (let key in rank_user_cnt_list) {
        let rank_user_count_list = rank_user_cnt_list[key]
        if (isset(rank_user_count_list[3]) && intval(rank_user_count_list[3]) > 0) {
          main_index_list.push(key)
          delete rank_user_cnt_list_origin[key]
          main_rank_cnt++;
          if (main_rank_cnt === 2) {
            break;
          }
        }
      }
      if (main_rank_cnt < 2) {
        return false;
      }
      for (let key in rank_user_cnt_list_origin) {
        let rank_user_count_list = rank_user_cnt_list_origin[key]
        if (isset(rank_user_count_list[11]) && intval(rank_user_count_list[11]) > 0) {
          vip_rank_cnt++;
        } else {
          if (isset(rank_user_count_list[3]) && intval(rank_user_count_list[3]) > 0) {
            for (let k in main_index_list) {
              let index = main_index_list[k]
              if (isset(rank_user_cnt_list[index][11]) && intval(rank_user_cnt_list[index][11]) > 0) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        }
      }
      return true;
    }
  }
  public check_user_is_active = async (user_id: number | string) => {
    let user_info = await this.getOne({ id: user_id })
    let where = { id: user_id }
    let active_license_list = await licenseService.getOne({ user_id: user_id, status: 1 })
    if (intval(user_info['user_type']) === 0) {
      if (empty(active_license_list)) {
        await this.update({ is_paid: 0, is_active: 0 }, where);
        await licenseService.delete({user_id: user_id})
        return false;
      } else {
        await this.update({ is_paid: 1, is_active: 1 }, where);
        return true;
      }
    } else {
      return intval(user_info['is_active']) === 1 ? true : false;
    }
  }
  public check_user_is_paid = async (user_id: number | string) => {
    let user_info = await this.getOne({ id: user_id })
    let where = { id: user_id }
    let paid_license_list = await licenseService.getOne({ user_id: user_id, status: 1 })
    if (intval(user_info['user_type']) === 0) {
      if (empty(paid_license_list)) {
        await this.update({ is_paid: 0, is_active: 0 }, where);
        return false;
      } else {
        await this.update({ is_paid: 1, is_active: 1 }, where);
        return true;
      }
    } else {
      return intval(user_info['is_active']) === 1 ? true : false;
    }
  }
  public check_user_has_active_license = async (user_id: number | string) => {
    let paid_license_list = await licenseService.getOne({ user_id: user_id, status: 1 })
    if (empty(paid_license_list)) {
      return false;
    } else {
      return true;
    }
  }
  public trial_license_used = async (user_id: number | string) => {
    let user = await this.getOne({ id: user_id })
    if (isset(user['trial_used']) && intval(user['trial_used']) > 0) {
      return true;
    } else {
      return false;
    }
  }
  public check_user_has_trial_license = async (user_id: number | string) => {
    let paid_license_info = await licenseService.getOne({ user_id: user_id, status: 1 });
    if (empty(paid_license_info)) {
      return false;
    } else {
      let is_trial = intval(paid_license_info['is_trial']);
      if (is_trial) {
        return true;
      } else {
        return false;
      }
    }
  }
  public check_user_has_free_license = async (user_id: number | string) => {
    let license_list = await licenseService.getOne({ user_id: user_id, status: 1, license_type: 1 })
    if (empty(license_list)) {
      return false;
    } else {
      return true;
    }
  }

  public check_user_has_cancelled_license = async (user_id: number, user_type: number | string = 0) => {
    let license_info = await licenseService.getOne({ user_id: user_id, status: '1' });
    if (!empty(license_info)) {
      let is_cancelled = intval(license_info['is_cancelled']);
      if (is_cancelled === 1) {
        let add_timestamp = intval(license_info['add_timestamp']);
        let period_fee_duration = 0;
        if (intval(license_info['is_trial']) === 1) {
          period_fee_duration = TRIAL_LICENSE_DURATION;
        } else {
          period_fee_duration = LICENSE_LIFE_TIME
        }
        let remain_timestamp = (period_fee_duration * 86400) - (get_utc_timestamp() - add_timestamp);
        if (remain_timestamp <= 0) {
          let sql = "delete from " + TB_LICENSE + " where user_id = " + user_id;
          await licenseService.query(sql)
          await this.check_user_is_active(user_id);
          return [1, 'Your account is inactive! To reactivate your account, please go on "Membership" and follow the instructions.']
        } else {
          let remain_date_time = get_time_remain(remain_timestamp);
          if (user_type === 0) {
            return [2, 'You have cancelled your membership! Your account stays active for the next ' + remain_date_time + '. You will not be charged anymore.']
          } else {
            return [2, 'You have cancelled your membership! It will stays active for the next ' + remain_date_time + '. Please be aware that your affiliate upgrade is still active!']
          }
        }
      } else {
        return [0, 'You have active license']
      }
    } else {
      return [1, 'Your account is inactive! To reactivate your account, please go on "Membership" and follow the instructions.']
    }
  }

  public upgrade_affiliate_info = async (user_info: object) => {
    let rank_no = 12;
    let rank_name = "";
    let user_tree_rank = await this.getUserRank(user_info['id']);
    if (!empty(user_tree_rank)) {
      let rank_info = user_tree_rank['rank_info'];
      rank_name = get_data_value(rank_info, 'rank_name');
      rank_no = get_data_value(rank_info, 'rank_no', 12);
      //let tree_info = user_tree_rank['tree_info'];
    }
    let update_data = {
      rank_no: rank_no,
      rank_name: rank_name,
      rank_updated_timestamp: get_utc_timestamp()
    }
    await this.update(update_data, { id: user_info['id'] })
    return true
  }







}

export const userService = new UserService();
