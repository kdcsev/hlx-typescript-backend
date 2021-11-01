import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_data_value, get_utc_timestamp, intval, in_array, isset, is_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import { pdfCreator } from '../../library/pdfcreator';

export default class UserPaymentController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getPageDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = { user_id: data['user']['id'], user_deleted: '0' }

    let list = await transactionService.getAll(condition, "id desc");
    if (empty(list)) list = <any>[];
    for (let key in list) {
      let item = list[key]
      let trans_id = item['trans_id'];
      let trans_id_obj = trans_id.split('_')
      let trans_number = trans_id_obj[trans_id_obj.length - 1];

      let trans_id_str = ""
      if (trans_id.indexOf("rebill_affiliate") > -1) {
        trans_id_str = "Affiliate Package (Rebill)";
      } else if (trans_id.indexOf("rebill_license") > -1) {
        trans_id_str = "Membership (Rebill)";
      } else if (intval(item['paid_amount']) === 1) {
        trans_id_str = "Membership";
      } else if (floatval(item['paid_amount']) === AFFILIATE_COMMISSION) {
        trans_id_str = "Affiliate Package";
      } else {
        trans_id_str = "Membership";
      }
      trans_id_str += " " + trans_number;
      list[key]['trans_id_str'] = trans_id_str
    }

    data['payment_list'] = list;
    return this.json_output_data(data);
  }

  /// api for download
  public downloadInvoice = async (req: Request, res: Response) => {
    const fs = require('fs');
    const path = require('path');

    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    //let data = this.data;
    let token = get_data_value(post_param, 'token')

    let user = await this.checkLoginToken(token)
    if (empty(user)) {
      res.status(200).end();
      return false
    }
    console.log('user info', user)

    /**************************************************************************************************/
    let id = get_data_value(post_param, 'payment_id')
    let payment_date = get_data_value(post_param, 'payment_date')
    
    let item = await transactionService.getOne({ id: id })
    console.log('item', item)

    let trans_id = item['trans_id'];
    let trans_id_obj = trans_id.split('_')
    let trans_number = trans_id_obj[trans_id_obj.length - 1];

    let trans_id_str = ""
    if (trans_id.indexOf("rebill_affiliate") > -1) {
      trans_id_str = "Affiliate Package (Rebill)";
    } else if (trans_id.indexOf("rebill_license") > -1) {
      trans_id_str = "Membership (Rebill)";
    } else if (intval(item['paid_amount']) === 1) {
      trans_id_str = "Membership";
    } else if (floatval(item['paid_amount']) === AFFILIATE_COMMISSION) {
      trans_id_str = "Affiliate Package";
    } else {
      trans_id_str = "Membership";
    }
    item['invoice_number'] = trans_number;
    item['trans_type'] = trans_id_str;
    item['payment_date'] = payment_date;

    let user_info = await userService.getOne({id: item['user_id']})
    item['user_info'] = user_info;

    let [pdf_path, pdf_file_name] = await pdfCreator.create_invoice_pdf(item);

    setTimeout(function () {

      // res is a Stream object
      res.setHeader(
        "Content-Type",
        "application/pdf"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" + pdf_file_name
      );
      var file = pdf_path // path.join(__dirname, pdf_path);
      console.log('------file---------', file);

      const file_data = fs.readFileSync(file)
      console.log('file_data', file_data)
      res.send(file_data);
    }, 500)
  }






}

export const userPaymentController = new UserPaymentController()
