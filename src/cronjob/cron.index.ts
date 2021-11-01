import { CronJob } from 'cron';
import { Logger } from '../library/logger';
import { CRON_FUNC, WHM_FUNC } from '../var/env.config';
import { cronAffiliate } from './cron.affiliate';
import { cronDaily } from './cron.daily';
import { cronEmail } from './cron.email';
import { cronHoldingTank } from './cron.holding.tank';
import { cronVps } from './cron.vps';
import { cronVpsOrder } from './cron.vps.order';

export default class CronIndex {
    constructor() {
        this.startCron()
    }

    public startCron = async () => {
        //Logger.info("--------cron logging-----------")
        if(CRON_FUNC === 'disabled') {
            return false
        }else{
            console.log('---------------cron started----------------')
            cronEmail.startCron()
            if (WHM_FUNC !== 'disabled') {
                cronVps.startCron()
                cronVpsOrder.startCron()
            }
            cronHoldingTank.startCron()
            cronDaily.startCron()
            cronAffiliate.startCron()
        }
    }
}

export const cronIndex = new CronIndex()