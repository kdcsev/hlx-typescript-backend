import { Request, Response } from 'express'
import { adminService } from '../../services/admin.service';
import { empty, encrypt_md5, get_data_value, get_utc_timestamp, intval } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import AdminBaseController from './admin.base.controller';

export default class AdminCommonController extends AdminBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getProfileInfo = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    return this.json_output_data(data);
  };

  public updateProfileInfo = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = { admin_id: user['admin_id'] }
    let admin_info = {}
    admin_info['admin_name'] = post_param['admin_name']
    admin_info['admin_email'] = post_param['admin_email']
    if (!empty(post_param['admin_password'])) {
      admin_info['admin_password'] = encrypt_md5(post_param['admin_password']);
    }
    await adminService.update(admin_info, condition);
    data['user'] = await adminService.getOne(condition)
    return this.json_output_data(data, "Profile has been updated successfully");
  };
}

export const adminCommonController = new AdminCommonController()
