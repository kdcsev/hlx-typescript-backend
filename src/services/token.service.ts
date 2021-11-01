import { is_empty } from "../helpers/misc";
import { TB_TOKENS } from "../var/tables";
import { BaseService } from "./base.service";

export default class TokenService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_TOKENS;
  }
  
}

export const tokenService = new TokenService();
