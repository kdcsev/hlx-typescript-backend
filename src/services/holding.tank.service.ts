import { is_empty } from "../helpers/misc";
import { TB_HOLD_TANK } from "../var/tables";
import { BaseService } from "./base.service";

export default class HoldingTankService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_HOLD_TANK;
  }
  
}

export const holdingTankService = new HoldingTankService();
