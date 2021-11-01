import { CronJob } from 'cron';
import { empty, send_email } from '../helpers/misc';
import { emailQueueService } from '../services/email.queue.service';
import { TB_EMAIL_QUEUE, TB_FEED } from '../var/tables';

export default class CronEmail {

    cronJob: CronJob;

    constructor() {
        this.cronJob = new CronJob('0 * * * * *', async () => {
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
        console.log('-------------------running cron (bulk email) (every minute: ' + new Date().toLocaleTimeString() + ')----------------------')

        let sql = "select * from " + TB_EMAIL_QUEUE + " where result = '' order by id asc limit 0,30";
        let list = await emailQueueService.query(sql)
        for (let key in list) {
            let row = list[key]
            await this.do_send_email(row['id']);
        }
    }
    public do_send_email = async (email_id: number) => { //processor in background for async function
        let where = { id: email_id }
        let email_record = await emailQueueService.getOne(where)
        if (empty(email_record)) {
            return false;
        }
        if (email_record['result'] !== "") {
            return false;
        }
        let result = send_email(email_record['to'], email_record['subject'], email_record['message']);
        let update_data = { result: 'failed' }
        if (result) {
            update_data = { result: 'success' }
        }
        await emailQueueService.update(update_data, where)
    }
}

export const cronEmail = new CronEmail()