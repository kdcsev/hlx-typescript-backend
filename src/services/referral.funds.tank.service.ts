import { Logger } from "../library/logger";
import { ACTIVE_CUSTOMER_COUNT, REFERRAL_FUNDS, REFERRAL_FUNDS_LIFE_TIME } from "../var/config";
import { array_under_reset, empty, floatval, get_utc_timestamp, intval, is_empty } from "../helpers/misc";
import { TB_REFERRAL_FUND_TANK } from "../var/tables";
import { BaseService } from "./base.service";
import { referralFundsHistoryService } from "./referral.funds.history.service";
import { userService } from "./user.service";

export default class ReferralFundsTankService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_REFERRAL_FUND_TANK;
  }

  public addReferralTank = async (child_id: number|string) => {
    let user_info = await userService.getOne({id: child_id})
    if(empty(user_info)) {
        return false;
    }
    if(empty(user_info['ref_id'])) {
        return false;
    }
    let parent_ref_user_info = await userService.getOne({encrypted_id: user_info['ref_id']})
    if(empty(parent_ref_user_info)) {
        return false;
    }
    /*if(intval($parent_ref_user_info['user_type']) !== 0){
        return false;
    }*/
    let condition = {
        user_id: parent_ref_user_info['id'],
        child_id: user_info['id']
    }
    let referral_funds_info = await this.getOne(condition);
    if(!empty(referral_funds_info)) {
        return false;
    }
    let tank_data = {
        user_id: parent_ref_user_info['id'],
        child_id: user_info['id'],
        amount: REFERRAL_FUNDS,
        is_paid: 0,
        is_expired: 0,
        last_paid_timestamp: get_utc_timestamp(),
        add_timestamp: get_utc_timestamp()
    }
    let id = await this.insert(tank_data);
    return id;
}

/*
 * $user_id : parent id
 * */
public payReferralFunds = async (user_id:number = 0) => {
    let timestamp = get_utc_timestamp() - (REFERRAL_FUNDS_LIFE_TIME * 86400);
    timestamp = intval(timestamp)
    let sql = "select * from "+TB_REFERRAL_FUND_TANK+" where last_paid_timestamp < "+timestamp;
    let record_list = await this.query(sql);
    if(empty(record_list)) {
        record_list = [];
        return record_list;
    }
    let record_list_adjusted = array_under_reset(record_list, 'user_id', 2);
    for(let user_id in record_list_adjusted){
      let record_list_1 = record_list_adjusted[user_id]
        let check_user_has_active_license = await userService.check_user_has_active_license(user_id);
        if(!check_user_has_active_license){
            continue;
        }

        let active_refer_customer_cnt = 0;
        let pay_cnt = 0;
        for(let key in record_list_1) {
          let info = record_list_1[key]
            let child_is_active = await userService.check_user_is_active(info['child_id']); //check user is active customer
            if(child_is_active) {
                active_refer_customer_cnt++;
            }
        }
        if(active_refer_customer_cnt > 0){
            if(active_refer_customer_cnt < ACTIVE_CUSTOMER_COUNT) {
                pay_cnt = active_refer_customer_cnt;
            }else{
                pay_cnt = active_refer_customer_cnt - ACTIVE_CUSTOMER_COUNT;
            }
            for(let key in record_list_1) {
              let info = record_list_1[key]
                if(pay_cnt > 0){
                    let pay_rslt = await this.payReferralFundItem(info)
                    if(pay_rslt) {
                        let update_data = {
                            is_paid: 1,
                            last_paid_timestamp: get_utc_timestamp()
                        }
                        await this.update(update_data, {id: info['id']})
                        pay_cnt--;
                    }else{
                        let update_data = {
                            is_expired: 1
                        }
                        await this.update(update_data, {id: info['id']});
                    }
                }
            }
        }
    }
    return record_list;
}
public payReferralFundItem = async (info:any)=>{
    let pay_rslt = false;
    let child_is_active = await userService.check_user_is_active(info['child_id']); //check user is active customer
    if(child_is_active){
        let user_info = await userService.getOne({id: info['user_id']})
        if(empty(user_info)) {
            return false;
        }
        if(intval(user_info['is_paid'])===0 || intval(user_info['is_active'])===0){
            return false;
        }
        let check_user_has_active_license = await userService.check_user_has_active_license(info['user_id']);
        if(!check_user_has_active_license){
            return false;
        }
        if(intval(user_info['user_type'])!==0){
            return false;
        }
        //only when user is active customer, then add credit $15
        let referral_funds_record = {
            user_id:info['user_id'],
            tank_id:info['id'],
            child_id:info['child_id'],
            amount: parseFloat(info['amount']),
            add_timestamp: get_utc_timestamp()
        }
        await referralFundsHistoryService.insert(referral_funds_record);
        Logger.info('credit added by cron');
        Logger.info(JSON.stringify(referral_funds_record));

        let balance = floatval(user_info['balance']);
        balance = balance + referral_funds_record['amount'];
        let user_update_data = {balance: balance}
        await userService.update(user_update_data, {id: info['user_id']})
        pay_rslt = true;
    }
    return pay_rslt;
}
  
}

export const referralFundsTankService = new ReferralFundsTankService();
