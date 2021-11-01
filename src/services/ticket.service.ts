import { TICKET_DAILY_LIMIT } from "../var/config";
import { empty, get_utc_timestamp, intval, is_empty } from "../helpers/misc";
import { TB_TICKET, TB_TICKET_MESSAGE } from "../var/tables";
import { BaseService } from "./base.service";
import { ticketMessageService } from "./ticket.message.service";
import { TICKET_IS_LIMITED } from "../var/env.config";

export default class TicketService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_TICKET;
  }

  public get_detail = async (condition: any) => {
    let info = await this.getOne(condition);
    if (empty(info)) {
      return info;
    }
    let where = {
      ticket_id: info['id']
    }
    let message_list = await ticketMessageService.getAll(where, 'id asc')
    if(empty(message_list)){
      message_list = <any>[]
    }
    info['message_list'] = message_list;
    return info;
  }

  public getUnreadTicketList = async (user_id: number) => {
    let sql = "select * from " + TB_TICKET + " where sender_id = " + user_id;
    sql += " and status = 'Answered'";
    sql += " order by update_timestamp desc, id desc";
    let ticket_list = await this.query(sql)
    let unread_ticket_list = []
    for (let key in ticket_list) {
      let row = ticket_list[key]
      let ticket_id = row['last_msg_id'];
      let msg_info = await ticketMessageService.getOne({ id: ticket_id });
      ticket_list[key]['msg_info'] = msg_info;
      if (intval(msg_info['is_read']) === 0) {
        unread_ticket_list.push(ticket_list[key])
      }
    }
    return unread_ticket_list
  }
  public getUnreadAdminTicketList = async (user_id: number) => {
    let sql = "select * from " + TB_TICKET + " where receiver_id = " + user_id;
    sql += " and (status = 'Opened' or status = 'Replied')";
    sql += " order by update_timestamp desc, id desc";
    let ticket_list = await this.query(sql)
    let unread_ticket_list = []
    for (let key in ticket_list) {
      let row = ticket_list[key]
      let ticket_id = row['last_msg_id'];
      let msg_info = await ticketMessageService.getOne({ id: ticket_id });
      ticket_list[key]['msg_info'] = msg_info;
      if(empty(msg_info)) {
        if (intval(row['is_read']) === 0) {
          unread_ticket_list.push(ticket_list[key])
        }
      }else{
        if (intval(msg_info['is_read']) === 0) {
          unread_ticket_list.push(ticket_list[key])
        }
      }
    }
    return unread_ticket_list
  }

  public _ticket_is_limited = async (user: object) => {
    if(TICKET_IS_LIMITED === "false") { //if unlimited ticket, then return false
      return false//
    }
    
    let is_limited = false;
    let current_timestamp = get_utc_timestamp()
    let start_timestamp = current_timestamp - 86400;
    let end_timestamp = current_timestamp
    let sql = "select id from " + TB_TICKET + " where sender_id = " + user['id'];
    sql += " and add_timestamp >= " + start_timestamp + " and add_timestamp <= " + end_timestamp;

    let ticket_list = await this.query(sql) as []
    if (!empty(ticket_list)) {
      if (ticket_list.length >= TICKET_DAILY_LIMIT) {
        is_limited = true;
      } else {
        is_limited = false;
      }
    }
    return is_limited;
  }
  public _mark_as_read = async (ticket_id: number) => {
    const where = {
      id: ticket_id,
    }
    await this.update({ is_read: 1 }, where);
    return true;
  }
}

export const ticketService = new TicketService();
