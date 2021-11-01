//  cron for affiliate rank and MLM tree

import { CronJob } from 'cron';
import { whm } from '../library/whm';
import { vpsOrderQueueService } from '../services/vps.order.queue.service';
import { empty, get_data_value, get_utc_timestamp, send_email } from '../helpers/misc';
import { emailQueueService } from '../services/email.queue.service';
import { TB_EMAIL_QUEUE, TB_FEED, TB_USER, TB_VPS_ORDER_QUEUE } from '../var/tables';
import { userService } from '../services/user.service';
import { Logger } from '../library/logger';

export default class CronAffiliate {

    cronJob: CronJob;

    constructor() {
        this.cronJob = new CronJob('2 * * * * *', async () => {
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
        console.log('-------------------running cron (affiliate) (every minute: ' + new Date().toLocaleTimeString() + ')----------------------')
        let sql = "select id, encrypted_id, user_type from " + TB_USER + " where user_type = 1 order by rank_updated_timestamp asc, id asc limit 0,1";
        let user_list = await userService.query(sql)
        for (let key in user_list) {
            let user_info = user_list[key]
            await userService.update({ rank_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] })
            await userService.upgrade_affiliate_info(user_info);
        }
    }

     

}

export const cronAffiliate = new CronAffiliate()