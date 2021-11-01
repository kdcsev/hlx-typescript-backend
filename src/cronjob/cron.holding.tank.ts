import { CronJob } from 'cron';
import { whm } from '../library/whm';
import { vpsOrderQueueService } from '../services/vps.order.queue.service';
import { empty, get_utc_timestamp, intval, send_email } from '../helpers/misc';
import { emailQueueService } from '../services/email.queue.service';
import { TB_EMAIL_QUEUE, TB_FEED, TB_HOLD_TANK, TB_VPS_ORDER_QUEUE } from '../var/tables';
import { Logger } from '../library/logger';
import { MAX_TANK_DURATION } from '../var/config';
import { holdingTankService } from '../services/holding.tank.service';
import { userService } from '../services/user.service';
import { treeService } from '../services/tree.service';

export default class CronHoldingTank {

    cronJob: CronJob;

    constructor() {
        this.cronJob = new CronJob('1 1 * * * *', async () => { //every hour
            try {
                await this.runCron();
            } catch (e) {
                console.error(e);
            }
        });
        //this.startCron()
    }

    public startCron = async () => {
        if (!this.cronJob.running) {
            this.cronJob.start();
        }
    }

    public runCron = async () => {
        console.log('-------------------running cron (assign holding tank) (every hour: ' + new Date().toLocaleTimeString() + ')----------------------')

        let available_tank_users = await this._get_available_tank_users();
        if (!empty(available_tank_users)) {
            for (let key in available_tank_users) {
                let info = available_tank_users[key]
                await this.assign_child_user(info['tree_parent_id'], info['tree_child_id']);
            }
            Logger.info(JSON.stringify(available_tank_users));
        }
    }
    public _get_available_tank_users = async () => {
        let timestamp = get_utc_timestamp() - MAX_TANK_DURATION * 86400;
        let sql = "select * from " + TB_HOLD_TANK + " where add_timestamp < " + timestamp + " order by add_timestamp asc";
        let query_rslt = await holdingTankService.query(sql)
        return query_rslt;
    }
    public assign_child_user = async (parent_encrypted_id: string | number, user_id: string | number) => {
        let condition = { tree_child_id: user_id }
        await holdingTankService.delete(condition);

        let parent_info = await userService.getOne({ encrypted_id: parent_encrypted_id });
        if (empty(parent_info)) return false;
        let user_info = await userService.getOne({ id: user_id });
        if (empty(user_info)) return false;

        let tree_parent_id = parent_info['encrypted_id'];
        let parent_tree_info = await treeService.getOne({ encrypted_id: tree_parent_id });
        if (empty(parent_tree_info)) return false;

        let search_result = await userService.searchAvailableAssignTree(parent_encrypted_id, intval(parent_tree_info['tree_level']) + 1);
        let default_lane_arr = userService.get_default_lane_arr()
        let tree_data = {
            user_id: user_info['id'],
            encrypted_id: user_info['encrypted_id'],
            tree_level: search_result['level'],
            tree_parent_id: search_result['tree_parent_id'],
            tree_position: search_result['tree_position'],
            available_lane: default_lane_arr.join(','),
            add_timestamp: get_utc_timestamp()
        }
        let tree_info = await treeService.getOne({ user_id: tree_data['user_id'], tree_parent_id: tree_data['tree_parent_id'] })
        if (empty(tree_info)) {
            await treeService.insert(tree_data);
        }
        await userService.checkLaneFull(tree_parent_id);
        return true;
    }

}

export const cronHoldingTank = new CronHoldingTank()