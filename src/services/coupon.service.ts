import { empty, intval, is_empty } from "../helpers/misc";
import { TB_COUPON } from "../var/tables";
import { BaseService } from "./base.service";
import * as mysql from 'mysql2';

export default class CouponService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_COUPON;
  }
  public checkCouponIsValid = async (coupon:string)=>{
    let condition = {
      name: coupon
    };
    let row = await this.getOne(condition);
    if(!empty(row)){
      if(intval(row['status']) === 1) {
        return row;
      }
    }
    return false
  }

  public checkCouponExists = async (info:object, id:number) => {
    let name = info['name'];
    name = mysql.escape(name);
    let sql = "select * from " + TB_COUPON + " where 1=1"
    sql += " and (name = " + name + ")";
    sql += " and id <> "+id
    let row = await this.query(sql);
    if(empty(row)){
      return false
    }else{
      return true
    }
  }
}

export const couponService = new CouponService();
