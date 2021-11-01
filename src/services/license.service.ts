import { RowDataPacket } from "mysql2";
import { FEE_PERIOD, TRIAL_LICENSE_DURATION } from "../var/config";
import { empty, intval, is_empty } from "../helpers/misc";
import { TB_LICENSE } from "../var/tables";
import { BaseService } from "./base.service";

export default class LicenseService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_LICENSE;
  }

  public getActiveLicenseList = async (user_id: number | string) => {
    let where = { user_id: user_id, status: 1 }
    let list = await this.getAll(where, 'add_timestamp asc')
    if (empty(list)) list = <RowDataPacket>[]
    return list;
  }

  public getLicenseDuration = (license_info: any) => {
    let period_fee_duration = intval(FEE_PERIOD);
    if (intval(license_info['is_trial']) === 1) {
      if(license_info['coupon'] === ''){
        period_fee_duration = intval(license_info['coupon_type'])
        if(empty(period_fee_duration)){
          period_fee_duration = TRIAL_LICENSE_DURATION
        }
      }else{
        period_fee_duration = intval(FEE_PERIOD);
      }
    }
    return period_fee_duration
  }

}

export const licenseService = new LicenseService();
