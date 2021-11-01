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
import { TB_TICKET, TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, MLM_LEG_COUNT, TICKET_DAILY_LIMIT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import { ticketService } from '../../services/ticket.service';
import FileUploader from '../../library/fileuploader';
import TicketMessageService, { ticketMessageService } from '../../services/ticket.message.service';

export default class UserTicketController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getListPageDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let condition = { sender_id: user['id'] }
    let list = await ticketService.getAll(condition, "id desc");
    if (empty(list)) list = <any>[];

    data['ticket_list'] = list;
    return this.json_output_data(data);
  }
  public submitTicket = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let is_limited = await ticketService._ticket_is_limited(user);
    if (is_limited) {
      return this.json_output_error("Maximum ticket limit reached,<br/> please try again in 24 hours.")
    }
    //console.log('============req files==============', req['files'] )

    let attachment_path = ""
    if (!empty(req['files'])) {
      let myUploader = new FileUploader(req['files'])
      //console.log("=================req['files']=================", req['files'])
      const [uploadResult, fileName] = await myUploader.uploadFile('upload_file', "ticket")
      //console.log('uploadResult, fileName', uploadResult, fileName)
      if (!uploadResult) {
        let errorMsg = <string>fileName
        return this.json_output_error(errorMsg)
      } else {
        attachment_path = <string>fileName
      }
    }

    let title = get_data_value(post_param, 'title')
    let description = get_data_value(post_param, 'description')
    if (title == "") {
      return this.json_output_error("Subject is empty")
    }
    let update_data = {
      title: title,
      description: description,
      sender_id: user['id'],
      sender_name: user['user_name'],
      receiver_id: 0,
      receiver_name: 'Admin',
      attachment_path: attachment_path
    }
    update_data['add_timestamp'] = get_utc_timestamp()
    update_data['update_timestamp'] = update_data['add_timestamp'];
    let id = await ticketService.insert(update_data);
    return this.json_output_data(data);
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
    await ticketMessageService._mark_as_read(id, user['id'])

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
    //console.log('============req files==============', req['files'] )

    let attachment_path = ""
    if (!empty(req['files'])) {
      let myUploader = new FileUploader(req['files'])
      const [uploadResult, fileName] = await myUploader.uploadFile('upload_file', "ticket")
      console.log('uploadResult, fileName', uploadResult, fileName)
      if (!uploadResult) {
        let errorMsg = <string>fileName
        return this.json_output_error(errorMsg)
      } else {
        attachment_path = <string>fileName
      }
    }

    const ticket_id = get_data_value(post_param, 'ticket_id')
    let condition = { id: ticket_id }
    let ticket_info = await ticketService.getOne(condition);
    if (empty(ticket_info)) {
      return this.json_output_error("Invalid request")
    }
    if (intval(ticket_info['sender_id']) !== intval(user['id'])) {
      return this.json_output_error("Permission is denied")
    }
    if (ticket_info['status'] == 'Closed') {
      return this.json_output_error("Ticket is already closed")
    }
    let message = get_data_value(post_param, 'description')
    if (message == "") {
      return this.json_output_error("Your reply is empty")
    }
    let update_data = {
      ticket_id: ticket_id,
      sender_id: user['id'],
      sender_name: user['user_name'],
      receiver_id: 0,
      receiver_name: 'Admin',
      message: message
    }
    update_data['attachment_path'] = attachment_path
    update_data['add_timestamp'] = get_utc_timestamp()
    let msg_id = await ticketMessageService.insert(update_data);
    let ticket_update_data = {
      status: 'Replied',
      last_msg_id: msg_id,
      update_timestamp: update_data['add_timestamp']
    }
    await ticketService.update(ticket_update_data, { id: ticket_id })
    await this._mark_as_read(ticket_id);
    return this.json_output_data(data, "Your reply has been submitted");
  }
  private _mark_as_read = async (ticket_id: number) => {
    let data = this.data;
    let user = data['user'];
    let where = {
      ticket_id: ticket_id,
      receiver_id: user['id']
    }
    await ticketMessageService.update({ is_read: 1 }, where)
    return true;
  }
  public closeTicket = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let id = get_data_value(post_param, 'id')
    let condition = {
      id: id
    }
    let info = await ticketService.get_detail(condition);
    if (empty(info)) {
      return this.json_output_error("Invalid request");
    }
    if (intval(info['sender_id']) !== intval(user['id'])) {
      return this.json_output_error("Permission is denied");
    }
    await ticketService.update({ status: 'Closed' }, condition);
    return this.json_output_data(data, "Ticket has been closed successfully");
  }




}

export const userTicketController = new UserTicketController()
