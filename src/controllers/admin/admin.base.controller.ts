import BaseController from '../base.controller'
import { Request, Response } from 'express'
import { empty, get_data_value } from '../../helpers/misc';
import { tokenService } from '../../services/token.service';
import { adminService } from '../../services/admin.service';

export default class AdminBaseController extends BaseController {
    public user: object = {};
    public data: object = {};
    constructor() {
        super();
    }

    protected checkLogin = async () => {
        let req = this.req
        let post_param: object = req['fields']
        let get_param: object = req['query']
        //console.log('req', req)
        let headers = req.headers
        let bearHeader = get_data_value(headers, 'authorization')
        if (!empty(bearHeader)) {
            const bear = bearHeader.split(' ');
            const bearToken = bear[1];
            console.log('bearToken', bearToken)
            if (!empty(bearToken)) {
                let condition = { token: bearToken, user_type:'admin' }
                let token_row = await tokenService.getOne(condition)
                if (!empty(token_row)) {
                    let user_id = token_row['user_id']
                    let user_info = await adminService.getOne({ id: user_id })
                    if (!empty(user_info)) {
                        //console.log('user_info', user_info);
                        this.user = user_info;
                        this.data = {user: user_info}; //this.data['user'] = user_info; //  
                        return this.data
                    }
                }
            }
        }
        this.json_output_error("Please login", { login_required: '1' });
        return false;
    }

    protected checkLoginToken = async (token:string) => {
        // let req = this.req
        // let post_param: object = req['fields']
        // let get_param: object = req['query']
        if (!empty(token)) {
            let condition = { token: token, user_type:'admin' }
            let token_row = await tokenService.getOne(condition)
            if (!empty(token_row)) {
                let user_id = token_row['user_id']
                let user_info = await adminService.getOne({ id: user_id })
                if (!empty(user_info)) {
                    return user_info
                }
            }
        }
        return false
    }
}
