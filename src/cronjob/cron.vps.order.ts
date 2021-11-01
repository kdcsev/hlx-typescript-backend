import { CronJob } from 'cron';
import { whm } from '../library/whm';
import { vpsOrderQueueService } from '../services/vps.order.queue.service';
import { empty, get_utc_timestamp, send_email } from '../helpers/misc';
import { emailQueueService } from '../services/email.queue.service';
import { TB_EMAIL_QUEUE, TB_FEED, TB_VPS_ORDER_QUEUE } from '../var/tables';

export default class CronVpsOrder {

    cronJob: CronJob;

    constructor() {
        this.cronJob = new CronJob('1 * * * * *', async () => {
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
        console.log('-------------------running cron (vps order accept) (every minute: ' + new Date().toLocaleTimeString() + ')----------------------')

        let sql = "select * from " + TB_VPS_ORDER_QUEUE + " where status = 'pending' and add_timestamp < date_sub(now(),interval 15 minute) order by add_timestamp asc limit 0,1";
        let row_list = await vpsOrderQueueService.query(sql);
        if (!empty(row_list)) {
            let row = row_list[0]
            const [result, output] = await whm.acceptOrder(row['orderid']);
            let update_data = {}
            if (result) {
                update_data['status'] = 'success';
            } else {
                update_data['status'] = 'failed';
                update_data['api_response'] = output;
            }
            update_data['update_timestamp'] = get_utc_timestamp()
            await vpsOrderQueueService.update(update_data, { id: row['id'] })
        }
    }

}

export const cronVpsOrder = new CronVpsOrder()