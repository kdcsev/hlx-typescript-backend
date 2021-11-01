import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, get_data_value, get_utc_timestamp, intval, in_array, isset, user_default_avatar } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { MAX_LEVEL, MLM_LEG_COUNT } from '../../var/config';
import AdminBaseController from './admin.base.controller';

export default class AdminTeamController extends AdminBaseController {
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
    let root_user_id = intval(get_data_value(get_param, 'root_user_id'))
    if (empty(root_user_id)) {
      root_user_id = user['id']
    }
    let check_in_holding_tank = await userService.checkUserInHoldingTank(user['id'])
    data['check_in_holding_tank'] = (check_in_holding_tank ? '1' : '0')
    let user_tree = await this.get_user_tree1(root_user_id, 0);
    data['user_tree'] = user_tree

    /************************************* get all tree user list *******************************************/
    let tree_user_list = await this.get_all_users_in_tree(root_user_id, 0);
    let user_ids = []
    for (let key in tree_user_list) {
      let row = tree_user_list[key]
      user_ids.push(intval(row['user_id']))
    }
    let all_users_in_tree = <any>[]
    if (!empty(user_ids)) {
      let sql = "select id, user_name, user_email from " + TB_USER + " where id in (" + (user_ids.join(',')) + ") order by user_name asc";
      all_users_in_tree = await userService.query(sql)
    }
    data['all_users_in_tree'] = all_users_in_tree;
    /************************************* end get all tree user list *******************************************/

    return this.json_output_data(data);
  }
  private get_user_tree1 = async (user_id: number, deep: number = 0) => {
    let data = this.data;
    let current_user = data['user'];

    if (deep > MAX_LEVEL) return false;

    let user_info = await userService.getOne({ id: user_id }); //root user info
    if (empty(user_info)) {
      user_info = this.get_empty_user();
    } else {
      user_info['has_downline'] = await userService.check_has_downline({ tree_parent_id: user_info['encrypted_id'] });
      if (!empty(user_info['user_image'])) {
        user_info['user_image'] = user_default_avatar();
      } else {
        if (intval(user_info['user_type']) === 0) {
          if (intval(user_info['is_active']) === 1 && intval(user_info['is_paid']) === 1) {
            if(user_info['license_status'] === 2) { //customer has free license
              if (current_user['encrypted_id'] == user_info['ref_id']) {
                user_info['user_image'] = user_default_avatar('5-p');
              } else {
                user_info['user_image'] = user_default_avatar(5);
              }
            }else{
              if (current_user['encrypted_id'] == user_info['ref_id']) {
                user_info['user_image'] = user_default_avatar('1-p');
              } else {
                user_info['user_image'] = user_default_avatar(1);
              }
            }
          } else {
            if (current_user['encrypted_id'] === user_info['ref_id']) {
              user_info['user_image'] = user_default_avatar('0-p');
            } else {
              user_info['user_image'] = user_default_avatar(0);
            }
          }
        } else {
          if (intval(user_info['is_paid']) === 1) {
            let check_user_has_active_license = await userService.check_user_has_active_license(user_info['id'])
            if (check_user_has_active_license) {
              if (current_user['encrypted_id'] === user_info['ref_id']) {
                user_info['user_image'] = user_default_avatar('4-p');
              } else {
                user_info['user_image'] = user_default_avatar(4);
              }
            } else {
              if (current_user['encrypted_id'] === user_info['ref_id']) {
                user_info['user_image'] = user_default_avatar('3-p');
              } else {
                user_info['user_image'] = user_default_avatar(3);
              }
            }
          } else {
            if (current_user['encrypted_id'] === user_info['ref_id']) {
              user_info['user_image'] = user_default_avatar('0-p');
            } else {
              user_info['user_image'] = user_default_avatar(0);
            }
          }

        }
      }
    }
    let condition = { tree_parent_id: user_info['encrypted_id'] }
    let child_list = await treeService.getAll(condition, "tree_position asc");
    if (!empty(child_list)) {
      child_list = array_under_reset(child_list, 'tree_position');
    }
    let child_list_reset = []
    for (let i = 0; i < MLM_LEG_COUNT; i++) {
      let child_user_info = this.get_empty_user();
      if (isset(child_list[i])) {
        child_user_info = child_list[i];
      }
      child_list_reset.push(child_user_info)
    }
    let child_list_final = []
    for (let key in child_list_reset) {
      let info = child_list_reset[key]
      let user_id1 = info['user_id'];
      let item = await this.get_user_tree1(user_id1, deep + 1);
      if (item) {
        child_list_final.push(item)
      }
    }
    let result: any;
    if (deep === 0) {
      result = []
      result.push({})
      result[deep]['level'] = deep;
      result[deep]['user_info'] = user_info;
      result[deep]['child_list'] = child_list_final;
    } else {
      result = {}
      result['level'] = deep;
      result['user_info'] = user_info;
      result['child_list'] = child_list_final;
    }
    return result;
  }
  private get_empty_user = () => {
    let user_info = {
      id: '0',
      user_id: '0',
      encrypted_id: '0',
      user_name: 'Empty',
      user_image: user_default_avatar(2),
      has_downline: '0'
    }
    return user_info;
  }
  private get_all_users_in_tree = async (user_id: number | string, deep = 0) => {
    let data = this.data;
    let current_user = data['user'];
    let user_info = await userService.getOne({ id: user_id })
    if (empty(user_info)) {
      return []
    }
    let condition = { tree_parent_id: user_info['encrypted_id'] }
    let child_list = await treeService.getAll(condition, "tree_position asc");
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

  public getUpLevelUser = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    
    let child_id = intval(get_param['user_id']);  
    let tree_info = await treeService.getOne({user_id: child_id})
    let tree_parent_id = tree_info['tree_parent_id']
    if(empty(tree_parent_id)){
      return this.json_output_error("Invalid request");
    }
    let up_user = await userService.getOne({encrypted_id: tree_parent_id})
    if(empty(up_user)){
      return this.json_output_error("Invalid request");
    }
    data['up_user'] = up_user;
    return this.json_output_data(data);
  }





}

export const adminTeamController = new AdminTeamController()
