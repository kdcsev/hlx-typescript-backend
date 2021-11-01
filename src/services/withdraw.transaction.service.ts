import { is_empty } from "../helpers/misc";
import { TB_WITHDRAW_TRANSACTION } from "../var/tables";
import { BaseService } from "./base.service";

export default class WithdrawTransactionService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_WITHDRAW_TRANSACTION;
  }
  
}

export const withdrawTransactionService = new WithdrawTransactionService();
