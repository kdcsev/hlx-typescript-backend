import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { empty, encrypt_md5, get_data_value, get_utc_timestamp, intval, isset } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';

export default class UserLicenseController extends UserBaseController {
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
    let condition = { user_id: data['user']['id'], status: '1' }
    let license_list = await licenseService.getAll(condition, 'id asc');
    if (empty(license_list)) license_list = <RowDataPacket>[];

    let enabled_membership = 1;
    let is_active_customer = 1;
    if (empty(license_list)) {
      enabled_membership = 0;
      is_active_customer = 0;
    } else {
      let license_info = license_list[0];
      if (intval(license_info['is_cancelled']) === 1) {
        enabled_membership = 0;
      }
    }
    data['enabled_membership'] = enabled_membership;
    data['is_active_customer'] = is_active_customer;
    data['license_list'] = license_list;

    return this.json_output_data(data);
  }

  public updateDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = {id: post_param['id']}
    let update_data = {license_number: post_param['license_number']}
    await licenseService.update(update_data, condition)
    return this.json_output_data(data);
  };



}

export const userLicenseController = new UserLicenseController()
