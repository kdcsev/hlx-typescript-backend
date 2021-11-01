import { Request, Response } from 'express'
import { BASE_FRONT_URL } from '../../var/env.config';
import { array_merge, array_under_reset, copy_object, decrypt__data, empty, encrypt_md5, encrypt__data, floatval, get_data_value, get_message_template, get_utc_timestamp, intval, in_array, isset, is_email, randomString, send_email } from '../../helpers/misc';
import { userService } from '../../services/user.service';
import UserBaseController from './user.base.controller';
import { holdingTankService } from '../../services/holding.tank.service';
import { whm } from '../../library/whm';
import { licenseService } from '../../services/license.service';
import { RowDataPacket } from 'mysql2';
import { academyService } from '../../services/academy.service';
import { rankRuleService } from '../../services/rank.rule.service';
import { TB_USER } from '../../var/tables';
import { treeService } from '../../services/tree.service';
import { AFFILIATE_COMMISSION, APP_NAME, MLM_LEG_COUNT } from '../../var/config';
import { payoutService } from '../../services/payout.service';
import { withdrawTransactionService } from '../../services/withdraw.transaction.service';
import { transactionService } from '../../services/transaction.service';
import { referralFundsTankService } from '../../services/referral.funds.tank.service';
import { Logger } from '../../library/logger';
import { twoFactAuth } from '../../library/twoFactAuth';
import { verificationCodeService } from '../../services/verification.code.service';

export default class UserVerificationController extends UserBaseController {
  constructor() {
    super();
  }

  public init = async (req: Request, res: Response) => {
    this.setReqRes({ req: req, res: res });
    return await this.checkLogin()
  }

  ///////////////////////////////////// starting apis //////////////////////////////////////////////
  public getPageDetail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let two_fact_secret = await twoFactAuth.getGaSecret()
    data['two_fact_secret'] = two_fact_secret
    let two_fact_qr_code_url = await twoFactAuth.getGaQRCode(two_fact_secret, APP_NAME)
    data['two_fact_qr_code_url'] = two_fact_qr_code_url;
    return this.json_output_data(data);
  }

  public sendVerificationEmail = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let code = user['id'] + '-' + randomString(5, true) + '-' + get_utc_timestamp();
    let verification_code = encrypt_md5(code);
    let verification_record = {
      user: user['user_email'],
      code: verification_code,
      type: 'email',
      verify_type: '2fa_auth',
      add_timestamp: get_utc_timestamp()
    }
    let condition1 = { user: user['user_email'], type: 'email', verify_type: '2fa_auth' }
    let verification_info = await verificationCodeService.getOne(condition1);
    if (!empty(verification_info)) {
      let update_data = {
        code: verification_code,
        add_timestamp: get_utc_timestamp()
      }
      await verificationCodeService.update(update_data, condition1);
    } else {
      await verificationCodeService.insert(verification_record);
    }
    let confirm_2fa_link = BASE_FRONT_URL + 'user/verification/confirm/' + verification_code;

    let message = get_message_template(9);
    let subject = "Confirm it's really you!";
    message = message.replace(/%%subject%%/gi, subject);
    message = message.replace(/%%user_name%%/gi, user['user_name']);
    message = message.replace(/%%confirm_2fa_link%%/gi, confirm_2fa_link);
    send_email(user['user_email'], subject, message);
    data['confirm_2fa_link'] = confirm_2fa_link
    return this.json_output_data(data);
  }

  public confirmVerificationCode = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/

    let code = get_param['code'];
    let condition = {
      code: code,
      user: user['user_email'],
      type: 'email',
      verify_type: '2fa_auth'
    }
    let verification_info = await verificationCodeService.getOne(condition);
    console.log('verification_info', verification_info)
    if (!empty(verification_info)) {
      let where = { id: user['id'] }
      await userService.update({ '2fa_status': 1 }, where);
      await verificationCodeService.delete(condition);
      return this.json_output_data(data, 'Confirmed successfully!')
    } else {
      return this.json_output_error('Invalid confirmation link!')
    }
  }
  public completeVerification = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let secret = get_data_value(post_param, 'secret'); //This is used to generate QR code
    let otp = get_data_value(post_param, 'otp'); //'385688' ;//Generated by Authenticator.

    const tolerance = 2;
    //Every otp is valid for 30 sec.
    // If somebody provides OTP at 29th sec, by the time it reaches the server OTP is expired.
    //So we can give tolerance =1, it will check current  & previous OTP.
    // tolerance =2, verifies current and last two OTPS
    let checkResult = await twoFactAuth.verifyCode(otp, secret)

    let condition = { id: user['id'] }
    if (checkResult) {
      //echo 'OTP is Validated Succesfully';
      let update_data = {
        '2fa_status': 3,
        '2fa_secret': secret
      }
      await userService.update(update_data, condition);
      return this.json_output_data('1', 'Two Step Verification is enabled successfully');
    } else {
      //echo 'FAILED';
      /*$update_data = array(
          '2fa_status'=>1
      );
      $this->user_model->update($update_data, $condition);*/
      return this.json_output_error('Two Step Verification is failed');
    }
  }
  public cancelVerification = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    if (user['2fa_status'] !== 3) {
      let condition = { id: user['id'] }
      let update_data = {
        '2fa_status': 0,
        '2fa_secret': ""
      }
      await userService.update(update_data, condition);
    }
    return this.json_output_data('1', 'Two Step Verification has been cancelled');
  }
  public disableVerification = async (req: Request, res: Response) => {
    if (empty(await this.init(req, res))) {
      return false
    }
    let post_param: object = req['fields'];
    let get_param: object = req['query'];
    let data = this.data;
    let user = this.user;
    /**************************************************************************************************/
    let secret = user['2fa_secret'];
    let otp = get_data_value(post_param, 'otp'); //'385688' ;//Generated by Authenticator.
    const tolerance = 2;
    //Every otp is valid for 30 sec.
    // If somebody provides OTP at 29th sec, by the time it reaches the server OTP is expired.
    //So we can give tolerance =1, it will check current  & previous OTP.
    // tolerance =2, verifies current and last two OTPS
    let checkResult = await twoFactAuth.verifyCode(otp, secret)

    if (checkResult || empty(secret)) {
      let condition = { id: user['id'] }
      let update_data = {
        '2fa_status': 0,
        '2fa_secret': ""
      }
      await userService.update(update_data, condition);
      return this.json_output_data('1', 'Two Step Authentication has been disabled');
    }else{
      return this.json_output_error('Incorrect verification code');
    }
  }



}

export const userVerificationController = new UserVerificationController()
