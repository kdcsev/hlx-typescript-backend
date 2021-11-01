import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_under_reset, empty, encrypt_md5, get_data_value, get_utc_timestamp, intval, isset } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';

export default class UserAcademyController extends UserBaseController {
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

    let user_is_active = await userService.check_user_has_active_license(user['id']);
    if (!user_is_active) {
      data['user_is_active'] = 0;
    } else {
      data['user_is_active'] = 1;
    }
    
    let user_is_trial = await userService.check_user_has_trial_license(user['id']);
    if (!user_is_trial) {
      data['user_is_trial'] = 0;
    } else {
      data['user_is_trial'] = 1;
    }
    return this.json_output_data(data);
  }

  public getLessonList = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let type = get_data_value(get_param, 'type');
    data['type'] = type;
    
    let academy_data = <RowDataPacket>[];
    if(type==='trial'){
        academy_data = await academyService.getAll({type: 'trial'}, 'id asc');
    }else if(type==='pro'){
        academy_data = await academyService.getAll({type: 'pro'}, 'id asc');
    }
    if(empty(academy_data)) academy_data = <RowDataPacket>[];

    academy_data = array_under_reset(academy_data,'phase_id',2);
    data['academy_data'] = academy_data;

    let user_is_active = await userService.check_user_has_active_license(user['id']);
    if (!user_is_active) {
      data['user_is_active'] = 0;
    } else {
      data['user_is_active'] = 1;
    }

    return this.json_output_data(data);
  }





}

export const userAcademyController = new UserAcademyController()
