import { empty, is_empty, rsort } from "../helpers/misc";
import { TB_RANK_RULE } from "../var/tables";
import { BaseService } from "./base.service";

export default class RankRuleService extends BaseService {
  constructor() {
    super();
    this.tableName = TB_RANK_RULE;
  }

  public get_rank_rule_detail = async (rank_no: number | string) => {
    let condition = { rank_no: rank_no }
    let rank_info = await this.getOne(condition)
    if (empty(rank_info)) {
      return false;
    } else {
      rank_info['line_max'] = rank_info['line_max'].split('/');
      rsort(rank_info['line_max']);
    }
    return rank_info;
  }
}

export const rankRuleService = new RankRuleService();
