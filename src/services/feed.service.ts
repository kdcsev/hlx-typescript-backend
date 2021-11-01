import { empty, get_data_value, intval, is_empty } from "../helpers/misc";
import { TB_ADMIN, TB_FEED } from "../var/tables";
import { BaseService } from "./base.service";

export default class FeedService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_FEED;
  }

  public read_feed = async (row: any, user_id: number | string) => {
    if (typeof row == 'number') {
      row = await this.getOne({ id: row });
    }
    if (empty(row)) {
      return false;
    }
    let condition = { id: row['id'] }
    let status: string = row['status'];
    let find: string = "," + user_id + ",";
    if (status.includes(find) === false) {
      if (empty(status)) {
        status = "," + user_id + ",";
      } else {
        status = status + user_id + ",";
      }
      let update_data = {
        status: status
      }
      await this.update(update_data, condition);
    }
    return true;
  }
  public read_all_feed = async (user_id: number) => {
    let str = ',' + user_id + ',';
    let sql = "select * from " + TB_FEED + " where status not like '%" + str + "%'";
    let row_list = await feedService.query(sql)
    if (empty(row_list)) {
      return false;
    }
    for (let key in row_list) {
      let row = row_list[key]
      await this.read_feed(row, user_id);
    }
    return true;
  }
  public check_is_read = async (row: object, user_id: number) => { //if read then true else false
    if (typeof row == 'number') {
      row = await this.getOne({ id: row });
    }
    if (empty(row)) {
      return false;
    }

    let status = row['status'];
    let find = "," + user_id + ",";
    if (status.includes(find) === false) {
      return false;
    } else {
      return true;
    }
  }
  public get_unread_feed_list = async (user_id: number) => {
    let str = ',' + user_id + ',';
    let sql = "select * from " + TB_FEED + " where status not like '%" + str + "%' order by id desc";
    let row_list = await feedService.query(sql);
    return row_list;
  }
  public get_unread_count = async (user_id: number) => {
    let str = ',' + user_id + ',';
    let sql = "select count(id) as cnt from " + TB_FEED + " where status not like '%" + str + "%'";
    let cnt = 0
    let row_list = await feedService.query(sql);
    if (!empty(row_list)) {
      let row = row_list[0]
      cnt = intval(get_data_value(row, 'cnt'));

    }
    return cnt;
  }



}

export const feedService = new FeedService();
