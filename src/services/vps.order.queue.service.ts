import { is_empty } from "../helpers/misc";
import { TB_ADMIN, TB_VPS_ORDER_QUEUE } from "../var/tables";
import { BaseService } from "./base.service";

export default class VpsOrderQueueService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_VPS_ORDER_QUEUE;
  }
  
}

export const vpsOrderQueueService = new VpsOrderQueueService();
