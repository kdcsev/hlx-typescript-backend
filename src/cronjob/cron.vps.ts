import { CronJob } from 'cron';
import { whm } from '../library/whm';
import { vpsOrderQueueService } from '../services/vps.order.queue.service';
import { empty, get_utc_timestamp, send_email } from '../helpers/misc';
import { emailQueueService } from '../services/email.queue.service';
import { TB_EMAIL_QUEUE, TB_FEED, TB_USER, TB_VPS_ORDER_QUEUE } from '../var/tables';
import { userService } from '../services/user.service';
import { Logger } from '../library/logger';
import { WHM_FUNC } from '../var/env.config';

export default class CronVps {

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
        console.log('-------------------running cron (vps) (every minute: ' + new Date().toLocaleTimeString() + ')----------------------')

        let sql = "select * from " + TB_USER + " where vps_status = 1 and vps_updated_timestamp < " + (get_utc_timestamp() - 86400) + " order by id asc limit 0,1";
        let user_list = await userService.query(sql)
        for (let key in user_list) {
            let user_info = user_list[key]
            let check_user_has_active_license = await userService.check_user_has_active_license(user_info['id']);
            if (check_user_has_active_license) {
                //$this->_update_vps('active');
            } else {
                await this._update_vps(user_info, 'inactive');
            }
            await userService.update({ vps_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] })
        }
    }

    public _update_vps = async (user_info: object, status: string = 'active') => { //status: active, inactive
        if (WHM_FUNC === 'disabled') {
            return true
        }
        let user_email = user_info['user_email'];
        if (status == 'active') {
            let client_info = await whm.checkClientExist(user_email);
            if (empty(client_info)) {
                const [result1, output1] = await whm.createClientAndOrder(user_info);
            }
            const [result, output] = await whm.moduleCreate(user_email);
            await userService.update({ vps_status: 1, vps_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] })
        } else {
            const [result, output] = await whm.moduleTerminate(user_email);
            await userService.update({ vps_status: 0, vps_updated_timestamp: get_utc_timestamp() }, { id: user_info['id'] })
            Logger.info("Module terminate (user: " + user_info['id'] + "): " + JSON.stringify(output))
        }
    }

}

export const cronVps = new CronVps()