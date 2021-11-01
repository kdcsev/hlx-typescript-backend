import { is_empty } from "../helpers/misc";
import { TB_GATEWAY } from "../var/tables";
import { BaseService } from "./base.service";

export default class GatewayService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_GATEWAY;
  }
  
}

export const gatewayService = new GatewayService();
