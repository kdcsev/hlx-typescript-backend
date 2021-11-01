import { CronJob } from 'cron';
import { whm } from '../library/whm';
import { vpsOrderQueueService } from '../services/vps.order.queue.service';
import { decrypt__data, empty, floatval, get_message_template, get_utc_timestamp, intval, isset, makePaySn, send_email } from '../helpers/misc';
import { emailQueueService } from '../services/email.queue.service';
import { TB_EMAIL_QUEUE, TB_FEED, TB_HOLD_TANK, TB_LICENSE, TB_PAYOUT, TB_VPS_ORDER_QUEUE } from '../var/tables';
import { Logger } from '../library/logger';
import { ACTIVE_CUSTOMER_COUNT, AFFILIATE_COMMISSION, FEE_PERIOD, LICENSE_PRICE, MAX_TANK_DURATION, TRIAL_LICENSE_DURATION } from '../var/config';
import { holdingTankService } from '../services/holding.tank.service';
import { userService } from '../services/user.service';
import { treeService } from '../services/tree.service';
import { licenseService } from '../services/license.service';
import { transactionService } from '../services/transaction.service';
import { FRONT_LOGIN_URL } from '../var/env.config';
import { info } from 'console';
import { nmi } from '../library/nmi';
import { referralFundsTankService } from '../services/referral.funds.tank.service';
import { payoutService } from '../services/payout.service';
import { rankRuleService } from '../services/rank.rule.service';

export default class CronDaily {

    cronJob: CronJob;

    constructor() {
        this.cronJob = new CronJob('1 1 0 * * *', async () => { //every day
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
        Logger.info('-------------------running cron (daliy cron) (every day: ' + new Date().toLocaleTimeString() + ')----------------------')

        await this.check_cancelled_license();
        await this.check_trial_license();
        await this.check_expired_license();
        await this.payCommission();
        await this.process_payout();
        await this.process_withdraw();
        await this.process_pay_referral_funds();
    }

    public check_cancelled_license = async () => {
        Logger.info('check cancelled licenses');
        let sql = "select *, count(id) as cnt from " + TB_LICENSE + " where status = '1' and is_cancelled = 1 group by user_id order by id asc";
        let license_list = await licenseService.query(sql)
        if (empty(license_list)) {
            return false;
        }
        for (let key in license_list) {
            let license_info = license_list[key]
            let user_id = intval(license_info['user_id']);
            let add_timestamp = intval(license_info['add_timestamp']);
            let period_fee_duration = licenseService.getLicenseDuration(license_info);
            if (get_utc_timestamp() - add_timestamp >= period_fee_duration * 86400) {
                sql = "delete from " + TB_LICENSE + " where user_id = " + user_id;
                await licenseService.query(sql);
                await this.check_user_is_active(user_id);
            }
        }
    }

    public payCommission = async () => { //pay for affiliate package
        Logger.info('payCommission balance');
        let period_fee_duration = FEE_PERIOD
        let affiliate_list = await userService.getAll({ user_type: 1, is_deleted: 0 });
        if (empty(affiliate_list)) return false;
        for (let key in affiliate_list) {
            let user_info = affiliate_list[key]
            if (get_utc_timestamp() - intval(user_info['last_commission_timestamp']) > period_fee_duration * 86400) {
                Logger.info('Pay commission user');
                Logger.info(JSON.stringify(user_info));
                let rebill_affiliate_commission_with_balance_rslt = await this.rebill_affiliate_commission_with_balance(user_info)
                if (!rebill_affiliate_commission_with_balance_rslt) {
                    let customer_id = user_info['customer_id'];
                    if (!empty(customer_id)) {
                        await this.rebill_affiliate_commission(user_info);
                    } else { //in this case, auto pay is impossible, so affiliate will become a customer back.
                        let params = { user_id: user_info['id'] }
                        await this.become_customer(params);
                    }
                }
            }
        }
    }
    public rebill_affiliate_commission_with_balance = async (user_info) => {
        let user_id = user_info['id'];
        let balance = floatval(user_info['balance']);
        let affiliate_commission = AFFILIATE_COMMISSION
        if (balance < affiliate_commission) {
            return false;
        } else {
            balance = balance - affiliate_commission;
            let params = {}
            params['trans_id'] = "rebill_affiliate_" + user_id + "_" + get_utc_timestamp();
            params['paid_amount'] = affiliate_commission;
            params['amount'] = affiliate_commission;
            params['client_ip'] = "127.0.0.1";
            params['description'] = "rebill_affiliate";
            params['user_id'] = user_id;
            params['payment_product'] = "rebill_affiliate";
            params['environment'] = "live";
            params['pay_sn'] = params['trans_id'];

            Logger.info('rebill_affiliate_commission_with balance');
            Logger.info(JSON.stringify(params));

            await transactionService.add_transaction(params, 'wallet');
            await this.update_affiliate_status(params);
            await userService.update({ balance: balance }, { id: user_id });
            return true;
        }
    }
    public check_trial_license = async () => {
        let period_fee_duration = TRIAL_LICENSE_DURATION;
        let user_list = await userService.getAll({ is_deleted: 0 });
        if (empty(user_list)) return false;
        for (let key in user_list) {
            let user_info = user_list[key]
            let user_id = user_info['id'];
            let sql = "select * from " + TB_LICENSE + " where status = '1' and is_trial = 1 and is_cancelled = 0 and user_id = " + user_id + " order by id asc limit 0,1";
            let license_list = await licenseService.query(sql)
            if (empty(license_list)) continue;
            for (let key1 in license_list) {
                let license_info = license_list[key1]
                let add_timestamp = intval(license_info['add_timestamp']);
                period_fee_duration = licenseService.getLicenseDuration(license_info);
                if (get_utc_timestamp() - add_timestamp >= period_fee_duration * 86400) {
                    await this.rebill_license(license_info);
                }
            }
        }
    }
    public check_expired_license = async () => {
        let period_fee_duration = FEE_PERIOD
        let user_list = await userService.getAll({ is_deleted: 0 });
        if (empty(user_list)) return false;
        for (let key in user_list) {
            let user_info = user_list[key]
            let user_id = user_info['id'];
            let can_have_free_license = await this.checkHas3ActiveMember(user_id);
            if (!can_have_free_license) { //if user has 3 active members, then he can not have free license
                await licenseService.update({ license_type: 0 }, { user_id: user_id });
                await userService.update({ license_status: 1 }, { id: user_id });
            }
            let sql = "select * from " + TB_LICENSE + " where status = '1' and is_trial = 0 and is_cancelled = 0 and user_id = " + user_id + " order by id asc limit 0,1";
            let license_list = await licenseService.query(sql)
            if (empty(license_list)) continue;
            for (let key1 in license_list) {
                let license_info = license_list[key1]
                let add_timestamp = intval(license_info['add_timestamp']);
                if (get_utc_timestamp() - add_timestamp >= period_fee_duration * 86400) {
                    let alreadyHasFreeLicense = await this.checkHasFreeLicense(user_id); //check already have free license
                    if (!alreadyHasFreeLicense || intval(license_info['license_type']) === 1) {
                        Logger.info('checkHas3ActiveMember'); //
                        if (can_have_free_license) {
                            await this.apply_free_license(license_info);
                        } else {
                            await this.rebill_license(license_info);
                        }
                    } else {
                        await this.rebill_license(license_info);
                    }
                }
            }
        }
    }
    public checkHasFreeLicense = async (user_id) => {
        let license_list = await licenseService.getAll({ license_type: 1, user_id: user_id }, 'add_timestamp asc')
        if (!empty(license_list)) {
            return true;
        } else {
            return false;
        }
    }
    public checkHas3ActiveMember = async (user_id) => {
        let result = true;
        let condition = { id: user_id, is_deleted: 0 }
        let user_info = await userService.getOne(condition);
        if (empty(user_info)) return false;

        if (intval(user_info['user_type']) > 0) { //if user is not customer then return false;
            return false;
        }
        let where = { ref_id: user_info['encrypted_id'], is_deleted: 0 }
        let ref_user_list = await userService.getAll(where);
        if (empty(ref_user_list)) return false;

        let active_child_cnt = 0;
        for (let key in ref_user_list) {
            let child_info = ref_user_list[key]
            if (intval(child_info['is_active']) === 1 && intval(child_info['license_status']) !== 2) {
                active_child_cnt++;
            }
            if (active_child_cnt >= ACTIVE_CUSTOMER_COUNT) {
                return true;
            }
        }
        return false;
    }
    public apply_free_license = async (license_info) => {
        let user_id = license_info['user_id'];
        let check_user_has_active_license = await userService.check_user_has_active_license(user_id);
        if (!check_user_has_active_license) {
            await userService.update({ license_status: 1 }, { id: user_id });
            return false;
        }
        Logger.info('apply free license');
        Logger.info(JSON.stringify(license_info));
        let condition = { user_id: license_info['user_id'] }
        let update_data = { status: '1', license_type: 1, add_timestamp: get_utc_timestamp() }; //license_type==1 => free license
        await licenseService.update(update_data, condition);
        await userService.update({ license_status: 2 }, { id: user_id });
        //$this->user_model->update(array('is_active'=>0), array('id'=>$user_id));
    }
    public rebill_license = async (license_info) => {
        Logger.info('rebill license');
        Logger.info(JSON.stringify(license_info));
        let license_price = LICENSE_PRICE;
        let where = { user_id: license_info['user_id'] }
        let user_id = license_info['user_id'];
        let condition = { id: user_id, is_deleted: 0 }
        let user_info = await userService.getOne(condition);
        let rebill_license_with_balance_result = await this.rebill_license_with_balance(user_info, license_info, license_price)
        if (rebill_license_with_balance_result) {
            return true;
        }

        if (empty(user_info) || empty(user_info['customer_id'])) {
            if (empty(user_info)) {
                //$this->license_model->delete($where);
                return false;
            }
            await licenseService.update({ status: '0', license_type: 0 }, where);
            await userService.update({ license_status: 0 }, { id: user_id });
            await this.check_user_is_active(user_id);
            return false;
        } else {
            let params = {
                payment_type: 'rebill',
                customer_id: user_info['customer_id'],
            }
            params['pay_sn'] = "rebill_" + makePaySn(user_id);
            if (intval(license_info['is_trial']) > 0) {
                params['is_trial'] = 1;
            } else {
                params['is_trial'] = 0;
            }
            params['amount'] = license_price;
            params['client_ip'] = "127.0.0.1";
            params['description'] = "rebill_license";
            params['user_id'] = user_id;
            params['payment_product'] = "rebill_license";
            await licenseService.update({ pay_sn: params['pay_sn'] }, where);
            let pay_result = await this.credit_card_payment(params); //$pay_result is transaction id
            if (!pay_result) {
                Logger.info('failed rebill license (user_id: ' + user_id + ')');
                await licenseService.update({ status: '2', license_type: 0 }, where);
                await userService.update({ license_status: 0 }, { id: user_id });
                await this.check_user_is_active(user_id);
                let subject = "Your card has been declined!";
                let message = get_message_template(12);
                message = message.replace(/%%subject%%/gi, subject);
                message = message.replace(/%%user_name%%/gi, user_info['user_name']);
                send_email(user_info['user_email'], subject, message);
                return false;
            } else {
                params['trans_id'] = pay_result;
                Logger.info('success rebill license (user_id: ' + user_id + ')');
                /////////////////////////////send invoice email to user//////////////////////////////////////////////////////
                let subject = "Order Confirmation!";
                let product_name = "Software License (Rebill)";
                let invoice_number = params['trans_id'];
                let message = get_message_template(2);
                message = message.replace(/%%subject%%/gi, subject);
                message = message.replace(/%%user_name%%/gi, user_info['user_name']);
                message = message.replace(/%%product%%/gi, product_name);
                message = message.replace(/%%invoice_number%%/gi, invoice_number);
                message = message.replace(/%%customer_username%%/gi, user_info['user_name']);
                message = message.replace(/%%login_url%%/gi, FRONT_LOGIN_URL);
                message = message.replace(/%%subtotal_price%%/gi, params['amount']);
                message = message.replace(/%%total_price%%/gi, params['amount']);
                message = message.replace(/%%recurring_subtotal_price%%/gi, params['amount']);
                message = message.replace(/%%recurring_total_price%%/gi, params['amount']);
                send_email(user_info['user_email'], subject, message);
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////
                return true;
            }
        }
    }
    public rebill_license_with_balance = async (user_info, license_info, license_price) => {
        if (empty(user_info)) {
            return false;
        }

        let user_id = user_info['id'];
        let balance = floatval(user_info['balance']);
        if (balance < license_price) {
            return false;
        } else {
            balance = balance - license_price;
            let params = {}
            params['trans_id'] = "rebill_license_" + user_id + "_" + license_info['id'] + "_" + get_utc_timestamp();
            params['paid_amount'] = license_price;
            params['amount'] = license_price;
            params['client_ip'] = "127.0.0.1";
            params['description'] = "rebill_license";
            params['user_id'] = user_id;
            params['payment_product'] = "rebill_license";
            params['environment'] = "live";
            params['pay_sn'] = license_info['pay_sn'];
            await transactionService.add_transaction(params, 'wallet');
            await this.update_license_status(params);
            await userService.update({ balance: balance }, { id: user_id });
            return true;
        }
    }
    public rebill_affiliate_commission = async (user_info) => {
        Logger.info('rebill_affiliate_commission');
        Logger.info(JSON.stringify(user_info));
        let affiliate_commission = AFFILIATE_COMMISSION
        let user_id = user_info['id'];
        let params = {
            payment_type: 'rebill',
            customer_id: user_info['customer_id'],
        }
        params['pay_sn'] = "rebill_" + makePaySn(user_id);
        params['amount'] = affiliate_commission;
        params['client_ip'] = "127.0.0.1";
        params['description'] = "rebill_affiliate";
        params['user_id'] = user_id;
        params['payment_product'] = "rebill_affiliate";
        let pay_result = await this.credit_card_payment(params); //$pay_result is transaction id
        if (!pay_result) {
            await this.become_customer(params);
            return false;
        } else {
            Logger.info('sent ip packeage paid email');
            params['trans_id'] = pay_result;
            /////////////////////////////send invoice email to user//////////////////////////////////////////////////////
            let subject = "Order Confirmation!";
            let product_name = "IP Package (Rebill)";
            let invoice_number = params['trans_id'];
            let message = get_message_template(4);
            message = message.replace(/%%subject%%/gi, subject);
            message = message.replace(/%%user_name%%/gi, user_info['user_name']);
            message = message.replace(/%%product%%/gi, product_name);
            message = message.replace(/%%invoice_number%%/gi, invoice_number);
            message = message.replace(/%%customer_username%%/gi, user_info['user_name']);
            message = message.replace(/%%login_url%%/gi, FRONT_LOGIN_URL);
            message = message.replace(/%%subtotal_price%%/gi, params['amount']);
            message = message.replace(/%%total_price%%/gi, params['amount']);
            message = message.replace(/%%recurring_subtotal_price%%/gi, params['amount']);
            message = message.replace(/%%recurring_total_price%%/gi, params['amount']);
            send_email(user_info['user_email'], subject, message);
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////
        }
    }
    public credit_card_payment = async (params) => {
        let user_info = userService.getOne({ id: params['user_id'], is_deleted: 0 });
        if (empty(user_info)) {
            return false;
        }
        let card_params = decrypt__data(user_info['customer_detail']);
        if (!empty(card_params)) {
            params['owner'] = card_params['owner'];
            params['cvc'] = card_params['cvc'];
            params['number'] = card_params['number'];
            params['exp_month'] = card_params['exp_month'];
            params['exp_year'] = card_params['exp_year'];
        } else {
            return false;
        }
        const [payment_status, payment_data] = await this._charge_credit_card(params);
        if (payment_status) {
            params['trans_id'] = payment_data['transactionid'];
            params['paid_amount'] = floatval(params['amount']);
            params['environment'] = (payment_data['livemode'] ? "live" : "test");
            await transactionService.add_transaction(params, 'nmi');
            if (params['payment_product'] == 'rebill_license') {
                await this.update_license_status(params);
            } else if (params['payment_product'] == 'rebill_affiliate') {
                await this.update_affiliate_status(params);
            }
        }
        if (payment_status) {
            Logger.info('credit card charge success');
            Logger.info(JSON.stringify(params));
            return params['trans_id'];
        } else {
            Logger.info('credit card charge failed');
            Logger.info(JSON.stringify(params));
            return false;
        }
    }
    public _charge_credit_card = async (params) => {
        //return array(false, "TEst failed"); //for testing

        let billing_data: object = {
            firstname: params['owner']
        }
        nmi.setBilling(billing_data);
        let shipping_data: object = {
            shipping_firstname: params['owner']
        }
        nmi.setShipping(shipping_data);
        let order_data: object = {
            ipaddress: params['client_ip'],
            orderid: params['pay_sn'],
            orderdescription: params['description'],
            tax: 0,
            shipping: 0,
            ponumber: params['pay_sn']
        }
        nmi.setOrder(order_data);
        let card_info: object = {
            ccnumber: params['number'],
            ccexp: params['exp_month'] + '' + params['exp_year'],
            cvv: params['cvv'],
            amount: params['amount']
        }
        const [payment_status, payment_data] = await nmi.doSale(card_info);
        return [payment_status, payment_data];

    }
    public update_license_status = async (params) => {
        let user_id = params['user_id'];
        let condition = { pay_sn: params['pay_sn'], user_id: user_id }
        let update_data = { status: '1', is_trial: 0 }
        update_data['add_timestamp'] = get_utc_timestamp();
        await licenseService.update(update_data, condition);
        await userService.update({ is_paid: 1, is_active: 1 }, { id: user_id });
        await referralFundsTankService.addReferralTank(user_id);
        return;
    }
    public update_affiliate_status = async (params) => {
        await userService.becomeAffiliate(params['user_id']);
        return;
    }
    public become_customer = async (params) => { //become customer from affiliate
        let user_id = params['user_id'];
        let condition = { id: user_id }
        let update_data = { user_type: 0, auto_commission: 'failed' }
        let check_user_has_active_license = await userService.check_user_has_active_license(user_id);
        if (check_user_has_active_license) {
            update_data['is_active'] = '1';
        } else {
            update_data['is_active'] = '0';
        }
        await userService.update(update_data, condition);
        return;
    }
    public check_user_is_active = async (user_id) => { //for the customer is active?
        let user_info = await userService.getOne({ id: user_id });
        if (intval(user_info['user_type']) > 0) {
            return true;
        }
        let where = { id: user_id }
        let active_license_list = await licenseService.getOne({ user_id: user_id, status: '1' });
        if (empty(active_license_list)) {
            await userService.update({ is_active: 0 }, where);
            await licenseService.delete({user_id: user_id});
        } else {
            await userService.update({ is_active: 1 }, where);
        }
    }

    public process_payout = async () => {
        let check_friday = await this.check_payout_date();
        if (!check_friday) {
            return false;
        }
        Logger.info("process payout");
        let condition = { user_type: 1, is_deleted: 0 }
        let affiliate_list = await userService.getAll(condition, 'id asc');
        if (empty(affiliate_list)) return []
        for (let key in affiliate_list) {
            let user_info = affiliate_list[key]
            let user_id = user_info['id'];
            let user_tree_rank = await userService.getUserRank(user_id);
            if (isset(user_tree_rank['rank_info']) && !empty(user_tree_rank['rank_info'])) {
                let payout_info = await this._get_payout_info(user_id, user_tree_rank);
                if (!empty(payout_info)) {
                    await payoutService.insert(payout_info);
                    Logger.info(JSON.stringify(payout_info));
                    let balance = floatval(user_info['balance']);
                    balance = balance + payout_info['paid_amount'];
                    let user_update_data = { balance: balance }
                    await userService.update(user_update_data, { id: user_id });
                    ///////////////////////////////send payout email/////////////////////////////////////////////////////////////

                    if (floatval(payout_info['paid_amount']) > 0) {
                        let subject = "You just got paid!";
                        let message = get_message_template(5);
                        message = message.replace(/%%subject%%/gi, subject);
                        message = message.replace(/%%user_name%%/gi, user_info['user_name']);
                        message = message.replace(/%%minimum_withdraw_price%%/gi, 50);
                        send_email(user_info['user_email'], subject, message);
                    }
                    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
                }
            }
        }
    }
    public _get_payout_info = async (user_id, user_tree_rank) => {
        let rank_info = user_tree_rank['rank_info'];
        let rank_no = intval(rank_info['rank_no']);
        let weekly_residuals = intval(rank_info['weekly_residuals']);
        let payout_info = {
            user_id: user_id,
            paid_amount: weekly_residuals,
            rank_no: intval(rank_info['rank_no']),
            description: rank_info['rank_name'],
            created_at: get_utc_timestamp(),
            user_deleted: '0',
            admin_deleted: '0'
        }

        /*check last payout (rank info)*/
        let last_payout_time = get_utc_timestamp() - (7 + 1) * 86400;
        let sql = "select * from " + TB_PAYOUT + " where user_id = " + user_id + " and created_at > " + last_payout_time;
        let rslt = await payoutService.query(sql)
        if (!empty(rslt)) {
            let last_payout = rslt[0];
            let last_rank_no = intval(last_payout['rank_no']);
            let last_rank_info = await rankRuleService.getOne({ rank_no: last_rank_no });
            if (rank_no > last_rank_no) { //rank is down
                payout_info = {
                    user_id: user_id,
                    paid_amount: rank_info['weekly_residuals'],
                    rank_no: intval(rank_info['rank_no']),
                    description: rank_info['rank_name'],
                    created_at: get_utc_timestamp(),
                    user_deleted: '0',
                    admin_deleted: '0'
                }
            } else { //rank is same or up.
                payout_info = {
                    user_id: user_id,
                    paid_amount: last_rank_info['weekly_residuals'],
                    rank_no: intval(rank_info['rank_no']),
                    description: rank_info['rank_name'],
                    created_at: get_utc_timestamp(),
                    user_deleted: '0',
                    admin_deleted: '0'
                }
            }
        } else {
            payout_info = {
                user_id: user_id,
                paid_amount: 0,
                rank_no: intval(rank_info['rank_no']),
                description: rank_info['rank_name'],
                created_at: get_utc_timestamp(),
                user_deleted: '1',
                admin_deleted: '1'
            }
        }
        return payout_info;
    }
    public check_payout_date = async () => {
        //return true;

        let dayofweek = new Date().getDay()
        Logger.info("Check Today is " + dayofweek);
        if (dayofweek === 5) { //current week is Friday
            Logger.info("Today is Friday");
            return true;
        } else {
            return false;
        }
    }

    public process_withdraw = async () => {
        return false;
    }

    public process_pay_referral_funds = async () => {
        let cur_day = new Date().getDate();
        cur_day = intval(cur_day)
        if (cur_day === 28) {
            await referralFundsTankService.payReferralFunds();
        }
    }
}

export const cronDaily = new CronDaily()