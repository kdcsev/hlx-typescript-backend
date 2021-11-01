import { intval, is_empty } from "../helpers/misc";
import { TB_TICKET_MESSAGE } from "../var/tables";
import { BaseService } from "./base.service";
import { ticketService } from "./ticket.service";

export default class TicketMessageService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_TICKET_MESSAGE;
  }

  public _mark_as_read = async (ticket_id: number, receiver_id: number) => {

    const where = {
      ticket_id: ticket_id,
      receiver_id: receiver_id
    }
    await this.update({ is_read: 1 }, where);

    let condition = { id: ticket_id }
    let info = await ticketService.getOne(condition);
    if(receiver_id=== 0 && intval(info['last_msg_id'])===0){
      await ticketService._mark_as_read(ticket_id)
    }
    return true;
  }

}

export const ticketMessageService = new TicketMessageService();
