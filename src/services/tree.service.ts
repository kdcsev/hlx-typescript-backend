import { is_empty } from "../helpers/misc";
import { TB_TREE } from "../var/tables";
import { BaseService } from "./base.service";

export default class TreeService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_TREE;
  }
  
}

export const treeService = new TreeService();
