import { is_empty } from "../helpers/misc";
import { TB_REFERRAL_FUND_HISTORY } from "../var/tables";
import { BaseService } from "./base.service";

export default class ReferralFundsHistoryService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_REFERRAL_FUND_HISTORY;
  }
  
}

export const referralFundsHistoryService = new ReferralFundsHistoryService();
