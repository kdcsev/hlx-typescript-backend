import { is_empty } from "../helpers/misc";
import { TB_PAYOUT } from "../var/tables";
import { BaseService } from "./base.service";

export default class PayoutService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_PAYOUT;
  }
  
}

export const payoutService = new PayoutService();
