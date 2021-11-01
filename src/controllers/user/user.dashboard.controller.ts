import { Request, Response } from 'express'
import { BASE_FRONT_URL, RANK_CRON_MODE } from '../../var/env.config';
import { array_merge, copy_object, empty, get_data_value, intval } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { treeService } from '../../services/tree.service';
import { TB_USER } from '../../var/tables';

export default class UserDashboardController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ////////////////////////////////////////// starting apis /////////////////////////////////////////////
  public getData = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    if(user['user_type'] > 0 ) {
      if (RANK_CRON_MODE !== 'true') { //if every thing is done(cron), we will set this as false //todo
        let user_tree_rank = await userService.getUserRank(user['id']);
        if (!empty(user_tree_rank)) {
          data['rank_info'] = user_tree_rank['rank_info'];
          data['user']['rank_name'] = get_data_value(data['rank_info'], 'rank_name');
          data['tree_info'] = user_tree_rank['tree_info'];
        } else {
          data['rank_info'] = {}
          data['user']['rank_name'] = "";
          data['tree_info'] = []
        }
      } else {
        data['tree_info'] = await userService.get_user_tree_only(user['encrypted_id']);
      }
    }else{
      data['rank_info'] = {}
      data['user']['rank_name'] = "";
      data['tree_info'] = await userService.get_user_tree_only(user['encrypted_id']);
    }

    let percent0 = 0;
    if (intval(get_data_value(data['tree_info'][0], 'active_member_cnt')) > 0) {
      percent0 = 100 * intval(get_data_value(data['tree_info'][0], 'active_customer_cnt')) / (intval(get_data_value(data['tree_info'][0], 'active_member_cnt')));
    }
    percent0 = parseFloat(percent0.toFixed(2));
    data['percent0'] = percent0;

    let percent1 = 0;
    if (intval(get_data_value(data['tree_info'][1], 'active_member_cnt')) > 0) {
      percent1 = 100 * intval(get_data_value(data['tree_info'][1], 'active_customer_cnt')) / (intval(get_data_value(data['tree_info'][1], 'active_member_cnt')));
    }
    percent1 = parseFloat(percent1.toFixed(2));
    data['percent1'] = percent1;

    let percent2 = 0;
    if (intval(get_data_value(data['tree_info'][2], 'active_member_cnt')) > 0) {
      percent2 = 100 * intval(get_data_value(data['tree_info'][2], 'active_customer_cnt')) / (intval(get_data_value(data['tree_info'][2], 'active_member_cnt')));
    }
    percent2 = parseFloat(percent2.toFixed(2));
    data['percent2'] = percent2;

    let active_personal_referral_cnt = intval(get_data_value(data['tree_info'][0], 'active_personal_referral_cnt')) + intval(get_data_value(data['tree_info'][1], 'active_personal_referral_cnt')) + intval(get_data_value(data['tree_info'][2], 'active_personal_referral_cnt'));
    data['active_personal_referral_cnt'] = active_personal_referral_cnt

    let active_member_count = 0;
    if (!empty(data['tree_info'])) {
      for (let pos in data['tree_info']) {
        let tree_info = data['tree_info'][pos]
        active_member_count += intval(tree_info['active_member_cnt']);
      }
    }
    data['active_member_count'] = active_member_count;

    let condition = { tree_parent_id: user['encrypted_id'] }
    let holding_user_cnt = await holdingTankService.countAll(condition);
    data['holding_user_cnt'] = holding_user_cnt;

    let check_in_holding_tank = await userService.checkUserInHoldingTank(user['id']);
    data['check_in_holding_tank'] = check_in_holding_tank;

    data['ref_url'] = BASE_FRONT_URL + "register?ref=" + user['user_name'];

    let sponsor_info = await userService.getOne({ encrypted_id: user['ref_id'] });
    data['sponsor_name'] = get_data_value(sponsor_info, 'user_name', 'Admin');
    if(user['user_type'] === 0){
      data['all_personal_referrals_in_tree'] = await this.get_all_personal_referrals_in_tree(user['id'], user['encrypted_id'])
    }else{
      data['all_personal_referrals_in_tree'] = false;
    }
    return this.json_output_data(data);
  };

  private get_all_personal_referrals_in_tree = async (user_id: number | string, ref_id:string) =>{
    let tree_user_list = await this.get_all_users_in_tree(user_id, 0);  
    let user_ids = [];
    for (let key in tree_user_list) {
      let row = tree_user_list[key]
      user_ids.push(intval(row['user_id']))
    }
    let all_personal_referrals_in_tree = <any>[]
    if (!empty(user_ids)) {
      let sql = "select id, ref_id, user_type, user_name, user_email, is_active from " + TB_USER + " where id in (" + (user_ids.join(',')) + ") and ref_id = '"+ref_id+"' order by user_name asc";
      all_personal_referrals_in_tree = await userService.query(sql);
    }
    return all_personal_referrals_in_tree;
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


}

export const userDashboardController = new UserDashboardController()
