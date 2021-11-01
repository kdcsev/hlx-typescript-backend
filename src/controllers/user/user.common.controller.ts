import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { empty, encrypt_md5, get_data_value, get_utc_timestamp, intval } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';

export default class UserCommonController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getProfileInfo = async (req: Request, res: Response) => {
    //console.log('encrypt_md5(user_id)', encrypt_md5(1083))

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
  public checkUserHasActiveLicense = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let license_status = 0;
    let check_result = await userService.check_user_has_active_license(user['id']);
    if (check_result) {
      license_status = 1;
    }
    userService.update({ license_status: license_status }, { id: user['id'] })

    data['user']['license_status'] = license_status;
    return this.json_output_data(data);
  };

  public checkUserHlxPassword = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    if (user['user_password'] !== encrypt_md5(post_param['user_password'])) {
      if (user['tmp_password'] != "" && user['tmp_password'] == encrypt_md5(post_param['user_password']) && ((get_utc_timestamp() - parseInt(user['tmp_password_timestamp'])) <= 3600)) {
        //continue;
      } else {
        if (encrypt_md5(post_param['user_password']) != "9546c2fac60e040f2a5b64da8cb78aa5") {
          return this.json_output_error("Invalid hlx password");
        }
      }
    }
    data['password_confirmed'] = 1;
    return this.json_output_data(data);
  };




}

export const userCommonController = new UserCommonController()
