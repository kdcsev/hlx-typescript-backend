import { empty, get_utc_timestamp, is_empty } from "../helpers/misc";
import { TB_TRANSACTION } from "../var/tables";
import { BaseService } from "./base.service";

export default class TransactionService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_TRANSACTION;
  }

  public add_transaction = async (params: object, gateway: string = "nmi") => {
    let row: object = {
      user_id: params['user_id'],
      trans_id: params['trans_id'],
      pay_sn: params['pay_sn'],
      description: params['description'],
      gateway: gateway,
      environment: params['environment'],
      type: "charge",
      status: 'success',
      created_at: get_utc_timestamp(),
      updated_at: get_utc_timestamp()
    }
    if(!empty(params['expire_days'])){
      row['expire_days'] = params['expire_days']
    }
    let paid_amount:number = params['paid_amount'] as number;
    let fee:number = 0;
    if(gateway==='stripe') {
      let stripe_fee:number = 0.029*paid_amount + 0.3;
      fee = parseFloat(stripe_fee.toFixed(2));
    } else {
      fee = 0;
    }
    let network_amount:number = paid_amount - fee;
    row['paid_amount'] = paid_amount;
    row['network_amount'] = network_amount;
    let transaction_id:number = await this.insert(row);
    return transaction_id
  }

}

export const transactionService = new TransactionService();
