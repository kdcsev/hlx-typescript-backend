import { is_empty } from "../helpers/misc";
import { TB_TREE, TB_VERIFICATION } from "../var/tables";
import { BaseService } from "./base.service";

export default class VerificationCodeService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_VERIFICATION;
  }
  
}

export const verificationCodeService = new VerificationCodeService();
