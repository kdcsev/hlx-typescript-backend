import { Request, Response } from 'express'
import { BASE_FRONT_URL, WHM_FUNC } from '../../var/env.config';
import { empty, encrypt_md5, get_data_value, get_utc_timestamp, intval, isset } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';

export default class UserVpsController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getVpsPassword = async (req: Request, res: Response) => {
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
    await this._update_vps();
    let product = await this._get_vps_product();
    if (empty(product)) {
      return this.json_output_error("Your VPS product can not be found");
    }

    let vps_order_detail = await this._get_vps_order_detail();
    let order_status = "";
    if (!empty(get_data_value(vps_order_detail['order'], 'status'))) {
      order_status = vps_order_detail['order']['status'];
    }
    if (order_status !== 'Active') {
      return this.json_output_error("Please wait until your VPS is ready", { vps_detail: vps_order_detail });
    }

    let vps_username = get_data_value(product, 'username', 'Administrator');
    let vps_password = get_data_value(product, 'password', '');
    data['vps_username'] = vps_username;
    data['vps_password'] = vps_password;
    return this.json_output_data(data);
  };

  private _update_vps = async () => { //status: active, inactive
    if (WHM_FUNC === 'disabled') {
      return true;
    }
    let data = this.data;
    let user_info = data['user'];
    let user_email = user_info['user_email'];
    let check_user_has_active_license = await userService.check_user_has_active_license(user_info['id']);
    let status = '';
    if (check_user_has_active_license) {
      if (intval(user_info['vps_status']) !== 1) {
        status = 'active';
      }
    } else {
      if (intval(user_info['vps_status']) !== 0) {
        status = 'inactive';
      }
    }

    if (status == 'active') {
      let client_info = await whm.checkClientExist(user_email);
      if (empty(client_info)) {
        const [result, output] = await whm.createClientAndOrder(user_info);
        //print_r($output); die;
      }

      const [result, output] = await whm.moduleCreate(user_email);
      if (result) {
        await userService.update({ vps_status: 1, vps_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] });
      }
    } else if (status == 'inactive') {
      const [result, output] = await whm.moduleTerminate(user_email);
      if (result) {
        await userService.update({ vps_status: 0, vps_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] });
      }
    }
    return true;
  }

  private _get_vps_product = async () => {
    //return true; //tmp
    let data = this.data;
    let user_info = data['user'];
    let user_email = user_info['user_email'];
    let product = await whm.getClientsProducts(user_email);
    return product;
  }

  private _get_vps_order_detail = async () => {
    //return true; //tmp
    let data = this.data;
    let user_info = data['user'];
    let user_email = user_info['user_email'];
    let vps_order_detail = await whm.getServiceId(user_email);
    return vps_order_detail;
  }

  public getConsoleUrl = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let user_info = data['user'];
    let user_email = user_info['user_email'];

    await this._update_vps(); //update vps before process

    let product = await this._get_vps_product();
    if (empty(product)) {
      return this.json_output_error("Your VPS product can not be found");
    }
    let vps_order_detail = await this._get_vps_order_detail();
    let order_status = "";
    if (!empty(get_data_value(vps_order_detail['order'], 'status'))) {
      order_status = vps_order_detail['order']['status'];
    }
    if (order_status !== 'Active') {
      return this.json_output_error("Your VPS is being created now. please wait a few minutes", { product: product, vps_detail: vps_order_detail });
    }

    const [result, output] = await whm.createSsoToken(user_email);
    if (result) {
      let redirect_url = output['redirect_url'];
      data['redirect_url'] = redirect_url;
      data['product'] = product;
      data['vps_order_detail'] = vps_order_detail;
      return this.json_output_data(data);
    } else {
      return this.json_output_error(output, vps_order_detail);
    }
  };




}

export const userVpsController = new UserVpsController()
