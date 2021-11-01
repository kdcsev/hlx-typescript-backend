import { is_empty } from "../helpers/misc";
import { TB_ACADEMY, TB_USER } from "../var/tables";
import { BaseService } from "./base.service";

export default class AcademyService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_ACADEMY;
  }
  
}

export const academyService = new AcademyService();
