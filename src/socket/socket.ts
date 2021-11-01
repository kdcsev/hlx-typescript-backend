import { array_merge, empty, encodeHtmlEntity, get_data_value, intval, isset } from '../helpers/misc'
import { Server } from 'http'
import * as https from 'https'
import { tokenService } from '../services/token.service'
import { userService } from '../services/user.service'
import * as socket from 'socket.io'
import { TB_FEED, TB_TICKET_MESSAGE } from '../var/tables'
import { feedService } from '../services/feed.service'
import { ticketService } from '../services/ticket.service'
import { ticketMessageService } from '../services/ticket.message.service'
import { adminService } from '../services/admin.service'

export const connected_client_list = {}

export class Socket {
  public io: socket.Server

  constructor(server: any) {
    this.io = new socket.Server(server, {
      cors: {
        origin: '*',
      }
    })
    //this.connected_client_list = {}
    this.connect()
  }

  public connect = () => {
    this.io.on('connection', (client: socket.Socket) => {
      // tslint:disable-next-line: no-console
      console.log(`------------Socket connected--------------- : ${client.id}`)
      console.log('Object.keys(connected_client_list)', Object.keys(connected_client_list))
      this.handlers(client)
      //client.emit('message', 'test message from server')
    })
  }

  public handlers = (client: socket.Socket) => {
    this.updateConnectedClientList('add', client)

    client.on('disconnect', () => {
      // tslint:disable-next-line: no-console
      console.log(`------------Socket disconnected--------------- : ${client.id}`)
      console.log('Object.keys(connected_client_list)', Object.keys(connected_client_list))
      this.updateConnectedClientList('delete', client)
    })

    client.on("message", (message: any) => {
      console.log('-----------socket MESSAGE-------------', message);
      client.emit('message', 'Server reply message')
    })

    client.on("get_feed_list", async (param: any) => {
      console.log('-----------get_feed_list param-------------', param);
      const feed_list = await this.getFeedList(param, client)
      //console.log('Object.keys(connected_client_list)', Object.keys(connected_client_list))
      //console.log('feed_list', feed_list)
      client.emit('get_feed_list', feed_list)

      const user_notification_data = await this.getUserNotificationData(param, client)
      client.emit('get_user_notification_data', user_notification_data)
    })

    client.on("get_user_notification_data", async (param: any) => {
      const user_notification_data = await this.getUserNotificationData(param, client)
      client.emit('get_user_notification_data', user_notification_data)
    })

    client.on("get_admin_notification_data", async (param: any) => {
      const admin_notification_data = await this.getAdminNotificationData(param, client)
      client.emit('get_admin_notification_data', admin_notification_data)
    })

    client.on("get_ticket_message_list", async (param: any) => {
      const ticketid = intval(get_data_value(param, 'ticketid'));
      const ticket_message_list = await this.getTicketMessageList(param, client)
      const output_data = {
        ticketid:ticketid,
        ticket_message_list:ticket_message_list
      }
      client.emit('get_ticket_message_list', output_data)
    })

    client.on("submit_new_ticket_message", async (param: any) => {
      const ticketid = intval(get_data_value(param, 'ticketid'));
      const ticket_message_list = await this.getTicketMessageList(param, client)
      const output_data = {
        ticketid:ticketid,
        ticket_message_list:ticket_message_list
      }
      const ticket_info = await this.getTicketUserInfo(param, client)
      if(!empty(ticket_info)){
        //console.log('Object.keys(connected_client_list)', Object.keys(connected_client_list))

        let user_cleint_list = this.getClientsFromUserID(ticket_info['sender_id'])
        //console.log('----------------user client list----------------', user_cleint_list)
        let admin_cleint_list = this.getClientsFromUserID(ticket_info['receiver_id'])
        //console.log('----------------admin client list----------------', admin_cleint_list)
      
        const user_notification_data = await this.getUserNotificationDataFromUserID(ticket_info['sender_id'])
        for(let i in user_cleint_list){
          let client_info = user_cleint_list[i]
          //console.log('---------send client id----------', client_info.id)
          this.io.sockets.to(client_info.id).emit('get_ticket_message_list', output_data)
          this.io.sockets.to(client_info.id).emit('get_user_notification_data', user_notification_data)
        }
        
        const admin_notification_data = await this.getAdminNotificationDataFromID(ticket_info['receiver_id'])
        for(let i in admin_cleint_list){
          let client_info = admin_cleint_list[i]
          //console.log('---------send admin client id----------', client_info.id)
          this.io.sockets.to(client_info.id).emit('get_ticket_message_list', output_data)
          this.io.sockets.to(client_info.id).emit('get_admin_notification_data', admin_notification_data)
        }
        //this.io.sockets.emit('get_ticket_message_list', output_data) //broadcast to all socket
        //this.io.emit('get_ticket_message_list', output_data)//broadcast to all socket
      }
    })

    client.on("submit_feed_item", async (param: any) => {
      //console.log('on submit_feed_item')
      const feedid = intval(get_data_value(param, 'feedid'));
      this.io.emit('submit_feed_item', {feedid:feedid})//broadcast to all socket
    })

    client.on("read_ticket_message_list", async (param: any) => {
      const ticketid = intval(get_data_value(param, 'ticketid'));
      const user = await this.readTicketMessageList(param, client)
      if (user['is_admin'] === '1') {
        const admin_notification_data = await this.getAdminNotificationData(param, client)
        client.emit('get_admin_notification_data', admin_notification_data)
      }else{
        const user_notification_data = await this.getUserNotificationData(param, client)
        client.emit('get_user_notification_data', user_notification_data)
      }
    })
  }

  /* action_type: add, delete */
  private updateConnectedClientList = (action_type: string, client: any, user_id: number = 0) => {
    let client_id: string = client.id
    let connected_client_info = get_data_value(connected_client_list, client_id)
    if (action_type === 'add') {
      if (!empty(connected_client_info)) {
        connected_client_info['user_id'] = user_id
        connected_client_list[client_id] = connected_client_info
      } else {
        connected_client_info = {}
        connected_client_info['user_id'] = user_id
        connected_client_info['client'] = {id: client_id}
        connected_client_list[client_id] = connected_client_info
      }
    } else if (action_type === 'delete') {
      if (!empty(connected_client_info)) {
        if(isset(connected_client_list[client_id])){
          delete connected_client_list[client_id]
        }
      }
    }
  }
  public getClientsFromUserID = (user_id: number) => {
    let client_list = []
    for (let key in connected_client_list) {
      let info = connected_client_list[key]
      if (info['user_id'] === user_id) {
        client_list.push(info['client'])
      }
    }
    return client_list
  }

  /////////////////////////////////////// start functions for logged in users //////////////////////////////////////////////////////////
  private checkLogin = async (param: object, client_info:socket.Socket) => {
    const bearToken = get_data_value(param, 'token')
    if (!empty(bearToken)) {
      let condition = { token: bearToken }
      let token_row = await tokenService.getOne(condition)
      if (!empty(token_row)) {
        if (token_row['user_type'] === 'user') {
          let user_id = token_row['user_id']
          let user_info = await userService.getOne({ id: user_id })
          if (!empty(user_info)) {
            user_info['is_admin'] = '0'
            //console.log('user_info', user_info);
            this.updateConnectedClientList('add', client_info, user_info['id'])
            return user_info
          }
        } else if (token_row['user_type'] === 'admin') {
          let admin_id = token_row['user_id']
          let user_info = await adminService.getOne({ admin_id: admin_id })
          if (!empty(user_info)) {
            user_info['id'] = admin_id
            user_info['is_admin'] = '1'
            //console.log('user_info', user_info);
            this.updateConnectedClientList('add', client_info, 0)
            return user_info
          }
        }

      }
      return false;
    }
  }

  private getFeedList = async (param: object, client_info:socket.Socket) => {
    const user = await this.checkLogin(param, client_info)
    if (empty(user)) {
      return []
    }
    const user_id = user['id'];
    const limit = 30;//30
    const last_id = intval(get_data_value(param, 'last_id'));
    let sql = "select u.* from " + TB_FEED + " as u where 1=1";
    if (last_id > 0) {
      sql += " and id < " + last_id;
    }
    sql += " order by id desc";
    sql += " limit 0, " + limit;
    //console.log("===========feed list sql==========", sql);
    let row_list = await feedService.query(sql)
    //console.log("===========feed row list ==========", row_list);

    for (let key in row_list) {
      let row = row_list[key]
      //row_list[key]['message'] = encodeHtmlEntity(row['message'])
      await feedService.read_feed(row, user_id);
    }
    return row_list
  }
  private getUserNotificationData = async (param: object, client_info:socket.Socket) => {
    const notificaiton_data = {}
    const user = await this.checkLogin(param, client_info)
    if (empty(user)) {
      return notificaiton_data
    }
    const user_id = user['id'];
    return await this.getUserNotificationDataFromUserID(user_id)
  }
  private getUserNotificationDataFromUserID = async (user_id:number) => {
    const user = await userService.getOne({id:user_id})
    const notificaiton_data = {}
    const unread_feed_list = await feedService.get_unread_feed_list(user_id)
    notificaiton_data['unread_feed_list'] = unread_feed_list
    const unread_ticket_list = await ticketService.getUnreadTicketList(user_id)
    notificaiton_data['unread_ticket_list'] = unread_ticket_list
    notificaiton_data['license_cancelled_message'] = ""
    if (intval(user['user_type']) === 0) {
      let [check_cancelled, check_cancelled_message] = await userService.check_user_has_cancelled_license(user['id'], user['user_type']);
      if (check_cancelled > 0) {
        notificaiton_data['license_cancelled_message'] = check_cancelled_message;
      }
    } else if (intval(user['user_type']) === 1) {
      let [check_cancelled, check_cancelled_message] = await userService.check_user_has_cancelled_license(user['id'], user['user_type']);
      if (check_cancelled === 2) {
        notificaiton_data['license_cancelled_message'] = check_cancelled_message;
      }
    }
    return notificaiton_data
  }
  private getAdminNotificationData = async (param: object, client_info:socket.Socket) => {
    const notificaiton_data = {}
    const user = await this.checkLogin(param, client_info)
    if (empty(user)) {
      return notificaiton_data
    }
    const user_id = 0
    return await this.getAdminNotificationDataFromID(user_id)
  }
  private getAdminNotificationDataFromID = async (user_id:number) => {
    const notificaiton_data = {}
    const unread_ticket_list = await ticketService.getUnreadAdminTicketList(user_id)
    notificaiton_data['unread_ticket_list'] = unread_ticket_list
    return notificaiton_data
  }
  private getTicketMessageList = async (param: object, client_info:socket.Socket) => {
    const user = await this.checkLogin(param, client_info)
    if (empty(user)) {
      return []
    }
    /////////////////////////////////////////start functions///////////////////////////////////////
    const user_id = user['id'];
    const ticketid = intval(get_data_value(param, 'ticketid'));
    const last_id = intval(get_data_value(param, 'last_id'));

    let sql = "select u.* from " + TB_TICKET_MESSAGE + " as u where 1=1 and ticket_id=" + ticketid;
    // if (last_id > 0) {
    //   sql += " and id > " + last_id;
    // }
    sql += " order by id asc";

    let row_list = await ticketMessageService.query(sql)
    // for (let key in row_list) {
    //   let row = row_list[key]
    // }
    return row_list
  }
  private getTicketUserInfo = async (param: object, client_info:socket.Socket) => {
    const ticketid = intval(get_data_value(param, 'ticketid'));
    let ticket_info = await ticketService.getOne({id: ticketid})
    return ticket_info
  }
  private readTicketMessageList = async (param: object, client_info:socket.Socket) => {
    const user = await this.checkLogin(param, client_info)
    if (empty(user)) {
      return []
    }
    /////////////////////////////////////////start functions///////////////////////////////////////
    const user_id = user['id'];
    const ticketid = intval(get_data_value(param, 'ticketid')); 
    let reader_id = user_id
    if (user['is_admin'] === '1') {
      reader_id = 0
    }
    await ticketMessageService._mark_as_read(ticketid, reader_id);
    return user
  }
}
