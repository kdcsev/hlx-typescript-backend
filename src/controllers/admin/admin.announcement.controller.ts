import { Request, Response } from 'express'
import * as mysql from 'mysql2';
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_data_value, get_message_template, get_utc_timestamp, intval, in_array, isset, is_email, send_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_FEED, TB_HOLD_TANK, TB_LICENSE, TB_TICKET, TB_TRANSACTION, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import AdminBaseController from './admin.base.controller';
import { Logger } from '../../library/logger';
import { ticketMessageService } from '../../services/ticket.message.service';
import { ticketService } from '../../services/ticket.service';
import FileUploader from '../../library/fileuploader';
import { feedService } from '../../services/feed.service';
import { emailQueueService } from '../../services/email.queue.service';

export default class AdminAnnouncementController extends AdminBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public submitData = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let update_data = {}
    update_data['subject'] = post_param['subject'];
    update_data['message'] = post_param['message'];
    let option = get_data_value(post_param, 'download_option');
    let searchQuery = " and (user_type = 0 or user_type = 1)";
    if (option == 'active') {
      searchQuery += " and is_active = 1";
    } else if (option == 'active') {
      searchQuery += " and is_active = 1";
    } else if (option == 'active_customer') {
      searchQuery += " and is_active = 1 and user_type = 0";
    } else if (option == 'affiliate') {
      searchQuery += " and is_active = 1 and user_type = 1";
    } else if (option == 'both') {
      searchQuery += " and is_active = 1 and user_type = 1";
    } else if (option == 'inactive_users') {
      searchQuery += " and is_active = 0";
    }

    let sql = "select u.id, u.user_email, u.user_name from " + TB_USER + " as u where 1=1" + searchQuery;
    let user_list = await userService.query(sql)
    let send_count = 0;
    let subject = update_data['subject'];//"Announcement from ".APP_NAME;
    let message = get_message_template(8);
    message = message.replace("%%announcement_body%%", update_data['message']);
    for (let key in user_list) {
      let row = user_list[key]
      if (option == 'affiliate') {
        let check = await userService.check_user_has_active_license(row['id']);
        if (check) {
          continue;
        }
      } else if (option == 'both') {
        let check = await userService.check_user_has_active_license(row['id']);
        if (!check) {
          continue;
        }
      }
      let message1 = message;
      message1 = message1.replace(/%%user_name%%/gi, row['user_name']);
      let rslt = await this.async_send_email(row['user_email'], subject, message1);
      //if (rslt) {
        send_count++;
      //}
    }
    return this.json_output_data(data, send_count+ " email" + (send_count > 1 ?'s':'') + " has been sent successfully");

  }
  private async_send_email = async (to: string, subject: string, message: string, cc_email: boolean = false, reply_email: string = '', from_name: string = '') => {
    if (to == '') {
      return false;
    }
    let email_data = {
      to: to,
      subject: subject,
      message: message,
      cc_email: cc_email ? 1 : 0,
      reply_email: reply_email,
      from_name: from_name
    }
    console.log('', email_data)
    return await emailQueueService.insert(email_data);
  }



}

export const adminAnnouncementController = new AdminAnnouncementController()
