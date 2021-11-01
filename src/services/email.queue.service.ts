import { is_empty } from "../helpers/misc";
import { TB_EMAIL_QUEUE } from "../var/tables";
import { BaseService } from "./base.service";

export default class EmailQueueService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_EMAIL_QUEUE;
  }
  
}

export const emailQueueService = new EmailQueueService();
