import { Request, Response } from 'express'
import * as mysql from 'mysql2';
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, empty, encrypt_md5, floatval, get_data_value, get_message_template, get_utc_timestamp, intval, in_array, isset, is_email, mail_attachment, send_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_HOLD_TANK, TB_LICENSE, TB_TICKET, TB_TRANSACTION, TB_USER } from '../../var/tables';
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

export default class AdminTicketController extends AdminBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getDataList = async (req: Request, res: Response) => { //api for datatable
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let per_page = intval(get_data_value(get_param, 'per_page', 10))
    let sql = ""
    sql = "select * from " + TB_TICKET + " where receiver_id = 0";

    if (isset(get_param['keyword1']) && !empty(get_param['keyword1'])) {
      let keyword1 = "%" + get_param['keyword1'] + "%";
      keyword1 = mysql.escape(keyword1);
      sql += " and (sender_name like " + keyword1 + " or title like " + keyword1 + " or description like " + keyword1 + ")";
    }
    if (isset(get_param['item_type']) && get_param['item_type'] !== "") {
      let item_type = mysql.escape(get_param['item_type']);
      sql += " and status = " + item_type;
    }

    //console.log('==================sql================', sql);
    if (isset(get_param['sort_column'])) {
      let sort_direction = get_data_value(get_param, 'sort_direction', 'asc')
      sql += " order by " + get_param['sort_column'] + " " + sort_direction
    }

    let rows = await licenseService.query(sql) as []
    let total = rows.length;

    let page = intval(get_data_value(get_param, 'page', 1))

    let offset = (page - 1) * per_page;
    sql += " limit " + offset + "," + per_page;
    let list = <RowDataPacket[]>await userService.query(sql)
    if (empty(list)) list = []

    data['page'] = page;
    data['per_page'] = per_page;
    data['total'] = total;

    let total_pages = 0
    if (total > 0) {
      total_pages = Math.ceil(total / per_page)
    }
    data['total_pages'] = total;
    data['data'] = list;

    return res.json(data)
  }
  public getInfoPageDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = get_data_value(get_param, 'ticketid')
    let condition = { id: id }
    let info = await ticketService.get_detail(condition);
    if (empty(info)) info = {}
    await ticketMessageService._mark_as_read(id, 0)
    data['ticket_info'] = info;
    return this.json_output_data(data);
  }
  public submitTicketMessage = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let ticket_id = get_data_value(post_param, 'ticket_id')
    let condition = { id: ticket_id }
    let ticket_info = await ticketService.getOne(condition);
    if (empty(ticket_info)) {
      return this.json_output_error("Invalid request")
    }
    if (ticket_info['status'] === 'Closed') {
      return this.json_output_error("Ticket is already closed")
    }

    let message = get_data_value(post_param, 'description')
    if (message == "") {
      return this.json_output_error("Your reply is empty")
    }

    let attachment_path = ""
    if (!empty(req['files'])) {
      let myUploader = new FileUploader(req['files'])
      const [uploadResult, fileName] = await myUploader.uploadFile('upload_file', "ticket")
      console.log('-----------------uploadResult, fileName--------------', uploadResult, fileName)
      if (!uploadResult) {
        let errorMsg = <string>fileName
        return this.json_output_error(errorMsg)
      } else {
        attachment_path = <string>fileName
      }
    }

    let to_email = intval(get_data_value(post_param, 'to_email'));
    if (to_email === 1) {
      let update_data = {
        message: message
      }
      if (attachment_path !== "") {
        update_data['attachment_path'] = attachment_path
      }

      let receiver_info = await userService.getOne({ id: ticket_info['sender_id'] })
      if (!empty(receiver_info)) {
        this.send_ticket_email(update_data, receiver_info);
      }
      return this.json_output_data('1', "Ticket email has been sent successfully");
    } else {
      let sender_admin_id = user['admin_id'];
      let sender_name = (user['admin_type'] == 'assistant' ? "Assistant" : "Admin");

      let update_data = {
        ticket_id: ticket_id,
        sender_id: 0,
        sender_admin_id: sender_admin_id,
        sender_name: sender_name,
        receiver_id: ticket_info['sender_id'],
        receiver_name: ticket_info['sender_name'],
        message: message
      }
      if (attachment_path !== "") {
        update_data['attachment_path'] = attachment_path
      }
      update_data['add_timestamp'] = get_utc_timestamp()
      let msg_id = await ticketMessageService.insert(update_data);
      let ticket_update_data = {
        status: 'Answered',
        last_msg_id: msg_id,
        update_timestamp: update_data['add_timestamp']
      }
      await ticketService.update(ticket_update_data, { id: ticket_id });
      await ticketMessageService._mark_as_read(ticket_id, 0)

      /**************************************** send ticket email ***************************************************/
      let receiver_info = await userService.getOne({ id: ticket_info['sender_id'] });
      if (!empty(receiver_info)) {
        let email_message = get_message_template(7);
        let subject = "We replied to your ticket!";
        email_message = email_message.replace(/%%subject%%/gi, subject);
        email_message = email_message.replace(/%%user_name%%/gi, receiver_info['user_name']);
        send_email(receiver_info['user_email'], subject, email_message);
      }
      /**************************************** end send ticket email ***************************************************/
    }
    return this.json_output_data(data, "Your reply has been submitted");
  }

  private send_ticket_email = async (update_data: object, receiver_info: object) => {
    let email_message = get_message_template(10);
    let subject = "We replied to your ticket!";
    email_message = email_message.replace(/%%subject%%/gi, subject);
    email_message = email_message.replace(/%%user_name%%/gi, receiver_info['user_name']);
    email_message = email_message.replace(/%%message%%/gi, update_data['message']);
    let attach_path_arr = []
    if (isset(update_data['attachment_path']) && !empty(update_data['attachment_path'])) {
      attach_path_arr.push(update_data['attachment_path'])
    }
    mail_attachment(receiver_info['user_email'], subject, email_message, "", attach_path_arr); //todo
  }

}

export const adminTicketController = new AdminTicketController()
